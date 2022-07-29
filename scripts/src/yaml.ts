import * as YAML from 'yaml'
import * as core from '@actions/core'
import * as fs from 'fs'
import {ManagedResources, State} from './terraform'
import {Schema} from './schema'
import {camelCaseToSnakeCase, env} from './utils'

function equals(a: unknown, b: unknown): boolean {
  if (YAML.isScalar(a) && YAML.isScalar(b)) {
    return a.value === b.value
  } else if (
    YAML.isPair(a) &&
    YAML.isPair(b) &&
    YAML.isScalar(a.key) &&
    YAML.isScalar(b.key)
  ) {
    return a.key.value === b.key.value
  } else {
    throw new Error(
      `Expected eiter 2 Scalars or 2 Pairs with Scalar keys, got these instead: ${a} and ${b}`
    )
  }
}

function isEmpty(a: unknown): boolean {
  if (YAML.isScalar(a)) {
    return a.value === undefined || a.value === null || a.value === ''
  } else if (YAML.isCollection(a)) {
    return a.items.length === 0
  } else {
    return false
  }
}

class Resource {
  type: string
  path: string[]
  value: YAML.Scalar | YAML.Pair

  constructor(type: string, path: string[], value: YAML.Scalar | YAML.Pair) {
    this.type = type
    this.path = path
    this.value = value
  }

  equals(other: Resource): boolean {
    return (
      this.type === other.type &&
      JSON.stringify(this.path) === JSON.stringify(other.path) &&
      equals(this.value, other.value)
    )
  }
}

export class Config {
  document: YAML.Document

  constructor(yaml: string) {
    this.document = YAML.parseDocument(yaml)
  }

  getJSON(): Schema {
    return this.document.toJSON()
  }

  sort(): void {
    const compare = new YAML.Schema({sortMapEntries: true}).sortMapEntries as (
      a: YAML.Pair<unknown, unknown>,
      b: YAML.Pair<unknown, unknown>
    ) => number
    YAML.visit(this.document, {
      Map(_, {items}) {
        items.sort(compare)
      }
    })
  }

  toString(): string {
    return this.document.toString({
      collectionStyle: 'block',
      singleQuote: false
    })
  }

  // similar to YAML.Document.getIn but accepts regex pattern in the path
  matchIn(type: string, path: string[]): Resource[] {
    function _matchIn(
      partialPath: string[],
      node: YAML.YAMLMap,
      history: string[]
    ): Resource[] {
      const [key, ...rest] = partialPath
      return node.items
        .filter(item => {
          if (YAML.isScalar(item.key) && typeof item.key.value === 'string') {
            return item.key.value.match(`^${key}$`)
          } else {
            throw new Error(
              `Expected a string Scalar, got this instead: ${JSON.stringify(
                item.key
              )}`
            )
          }
        })
        .flatMap(item => {
          const newHistory: string[] = [
            ...history,
            (item.key as YAML.Scalar).value as string
          ]
          if (rest.length === 0) {
            if (YAML.isCollection(item.value)) {
              return item.value.items.map(i => {
                if (YAML.isScalar(i) || YAML.isPair(i)) {
                  return new Resource(type, newHistory, i)
                } else {
                  throw new Error(
                    `Expected either a Scalar or a Pair, got this instead: ${JSON.stringify(
                      i
                    )}`
                  )
                }
              })
            } else {
              throw new Error(
                `Expected either a YAMLSeq or YAMLMap, got this instead: ${JSON.stringify(
                  item
                )}`
              )
            }
          } else {
            if (YAML.isMap(item.value)) {
              return _matchIn(rest, item.value, newHistory)
            } else {
              throw new Error(
                `Expected a YAMLMap, got this instead: ${JSON.stringify(item)}`
              )
            }
          }
        })
    }
    return _matchIn(path, this.document.contents as YAML.YAMLMap, [])
  }

  find(resource: Resource): Resource | undefined {
    const matchingResources = this.matchIn(resource.type, resource.path).filter(
      matchingResource => {
        return equals(resource.value, matchingResource.value)
      }
    )
    if (matchingResources.length === 0) {
      return undefined
    } else if (matchingResources.length === 1) {
      return matchingResources[0]
    } else {
      throw new Error(
        `Expected to find at most 1 matching resource, got these: ${JSON.stringify(
          matchingResources
        )}`
      )
    }
  }

  contains(resource: Resource): boolean {
    return this.find(resource) !== undefined
  }

  getResources(
    classes: typeof ManagedResources = ManagedResources
  ): Resource[] {
    return classes.flatMap(cls => {
      return this.matchIn(camelCaseToSnakeCase(cls.name), cls.yamlPath)
    })
  }

  remove(resource: Resource): void {
    core.info(`Removing ${JSON.stringify(resource)}`)
    // the resource might not exist anymore
    // e.g. if we removed a repository but then we try to remove repository collaborators
    if (this.contains(resource)) {
      const item = this.document.getIn(resource.path)
      if (YAML.isCollection(item)) {
        item.items = item.items.filter(i => {
          return !equals(i, resource.value)
        })
      } else {
        throw new Error(
          `Expected either a YAMLSeq or YAMLMap, got this instead: ${JSON.stringify(
            item
          )}`
        )
      }
    }
  }

  add(resource: Resource): void {
    core.info(`Adding ${JSON.stringify(resource)}`)
    // the resource might already exist
    // e.g. if we added repository collaborators and now we try to add repository
    if (!this.contains(resource)) {
      // this turns strings into string Scalars which we need for YAML.Document.addIn to work as expected
      const parsedPath = resource.path.map(p => YAML.parseDocument(p).contents)
      const item = this.document.getIn(resource.path)
      if (item === undefined) {
        if (YAML.isScalar(resource.value)) {
          this.document.addIn(parsedPath, YAML.parseDocument('[]').contents)
        } else if (YAML.isPair(resource.value)) {
          this.document.addIn(parsedPath, YAML.parseDocument('{}').contents)
        } else {
          throw new Error(
            `Expected either a Scalar or a Pair, got this instead: ${JSON.stringify(
              resource.value
            )}`
          )
        }
      }
      this.document.addIn(parsedPath, resource.value)
    }
  }

  update(resource: Resource, ignore: string[] = []): void {
    core.info(`Updating ${JSON.stringify(resource)}`)
    if (YAML.isScalar(resource.value)) {
      // do nothing, there's nothing to update in scalar values
    } else if (
      YAML.isPair(resource.value) &&
      YAML.isMap(resource.value.value)
    ) {
      const existingResource = this.find(resource)
      if (
        existingResource !== undefined &&
        YAML.isPair(existingResource.value) &&
        YAML.isMap(existingResource.value.value)
      ) {
        const existingValue = existingResource.value.value
        for (const item of resource.value.value.items) {
          const existingItem = existingValue.items.find(i => equals(i, item))
          if (existingItem !== undefined) {
            if (
              JSON.stringify(existingItem.value) !== JSON.stringify(item.value)
            ) {
              existingItem.value = item.value
            } else {
              // do nothing, there's no need to update this item
            }
          } else {
            existingValue.items.push(item)
          }
        }
        existingValue.items = existingValue.items.filter(item => {
          if (YAML.isScalar(item.key) && typeof item.key.value === 'string') {
            return !ignore.includes(item.key.value) && !isEmpty(item.value)
          } else {
            throw new Error(
              `Expected a string Scalar, got this instead: ${JSON.stringify(
                item.key
              )}`
            )
          }
        })
      } else {
        throw new Error(
          `Expected a YAMLMap inside a Pair, got this instead: ${JSON.stringify(
            existingResource?.value
          )}`
        )
      }
    } else {
      throw new Error(
        `Expected a YAMLMap inside a Pair, got this instead: ${JSON.stringify(
          resource.value
        )}`
      )
    }
  }

  async sync(
    state: State,
    ignoredChanges: Record<string, string[]>
  ): Promise<Config> {
    core.info('Syncing YAML config with TF state...')
    const resourcesInTFState = await state.getYAMLResources()
    const resourcesInConfig = this.getResources()

    // remove all the resources (from YAML config) that Terraform doesn't know about anymore
    const resourcesToRemove = resourcesInConfig.filter(resource => {
      return !resourcesInTFState.find(r => r.equals(resource))
    })
    for (const resource of resourcesToRemove) {
      this.remove(resource)
    }

    // add all the resources (to YAML config) that YAML config doesn't know about yet
    const resourcesToAdd = resourcesInTFState.filter(resource => {
      return !resourcesInConfig.find(r => r.equals(resource))
    })
    for (const resource of resourcesToAdd) {
      this.add(resource)
    }

    // update all the resources (in YAML config) with the values from Terraform state
    // we use resourcesInTFState because we want to update the config to the values from TF state
    const resourcesToUpdate = resourcesInTFState
    for (const resource of resourcesToUpdate) {
      this.update(resource, ignoredChanges[resource.type])
    }

    return this
  }

  save(sort = true): void {
    if (sort) {
      this.sort()
    }
    fs.writeFileSync(`${env.GITHUB_DIR}/${env.GITHUB_ORG}.yml`, this.toString())
  }
}

export {Resource}

export function parse(yaml: string): Config {
  return new Config(yaml)
}

export function getConfig(): Config {
  const yaml = fs
    .readFileSync(`${env.GITHUB_DIR}/${env.GITHUB_ORG}.yml`)
    .toString()
  return parse(yaml)
}
