import * as YAML from 'yaml'
import * as core from '@actions/core'
import * as fs from 'fs'
import {State} from './terraform'
import * as schema from './schema'
import {env} from './utils'

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
  path: string[]
  value: schema.Definition

  constructor(path: string[], value: schema.Definition) {
    this.path = path
    this.value = value
  }

  equals(other: Resource): boolean {
    if (
      typeof this.value === typeof other.value &&
      JSON.stringify(this.path) === JSON.stringify(other.path)
    ) {
      if (this.value instanceof String && other.value instanceof String) {
        return this.value.toString() == other.value.toString()
      } else {
        return true
      }
    } else {
      return false
    }
  }
}

export class Config {
  document: YAML.Document

  constructor(yaml: string) {
    this.document = YAML.parseDocument(yaml)
  }

  getJSON(): schema.Schema {
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
  matchIn(prototype: schema.DefinitionClass, path: string[]): Resource[] {
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
            if (YAML.isSeq(item.value)) {
              return item.value.items.map(i => {
                if (YAML.isScalar(i)) {
                  return new Resource(newHistory, prototype.fromPlain(i.toJSON()))
                } else {
                  throw new Error(
                    `Expected a Scalar, got this instead: ${JSON.stringify(
                      i
                    )}`
                  )
                }
              })
            } else if (YAML.isMap(item.value)) {
              return [new Resource(newHistory, prototype.fromPlain(item.value.toJSON()))]
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
    const matchingResources = this.matchIn(resource.value.constructor as schema.DefinitionClass, resource.path).filter(
      matchingResource => {
        return resource.equals(matchingResource)
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

  getAllResources(): Resource[] {
    return schema.DefinitionClasses.flatMap(prototype => {
      return this.getResources(prototype)
    })
  }

  getResources(prototype: schema.DefinitionClass): Resource[] {
    return this.matchIn(prototype, prototype.wildcardPath)
  }

  remove(resource: Resource): void {
    core.info(`Removing ${JSON.stringify(resource)}`)
    // the resource might not exist anymore
    // e.g. if we removed a repository but then we try to remove repository collaborators
    if (this.contains(resource)) {
      const item = this.document.getIn(resource.path)
      if (YAML.isSeq(item)) {
        const items = item.items.map(i => JSON.stringify((resource.value.constructor as schema.DefinitionClass).fromPlain(i)))
        const index = items.indexOf(JSON.stringify(resource.value))
        this.document.deleteIn([...resource.path, index])
      } else if (YAML.isMap(item)) {
        this.document.deleteIn(resource.path)
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
    // this turns strings into string Scalars which we need for YAML.Document.addIn to work as expected
    const parsedPath = resource.path.map(p => YAML.parseDocument(p).contents)
    const parsedValue = YAML.parseDocument(YAML.stringify(resource.value)).contents
    if (YAML.isScalar(parsedValue)) {
      if (this.find(resource) === undefined) {
        if (! this.document.hasIn(parsedPath)) {
          this.document.addIn(parsedPath, YAML.parseDocument('[]').contents)
        }
        this.document.addIn(parsedPath, parsedValue)
      }
    } else if (YAML.isMap(parsedValue)) {
      if (! this.document.hasIn(parsedPath)) {
        this.document.addIn(parsedPath, parsedValue)
      }
      const valueObject: any = {...resource.value}
      for (const key of Object.keys(valueObject)) {
        if (valueObject[key] !== undefined) {
          const path = [...parsedPath, YAML.parseDocument(YAML.stringify(key)).contents]
          const value = YAML.parseDocument(YAML.stringify(valueObject[key])).contents
          if (! this.document.hasIn(path)) {
            this.document.addIn(path, value)
          }
        }
      }
    } else {
      throw new Error(
        `Expected either a Scalar or a Map, got this instead: ${JSON.stringify(
          parsedValue
        )}`
      )
    }
  }

  update(resource: Resource, ignore: string[] = []): void {
    core.info(`Updating ${JSON.stringify(resource)}`)
    if (resource.value instanceof String) {
      // do nothing, there's nothing to update in scalar values
    } else {
      const parsedPath = resource.path.map(p => YAML.parseDocument(p).contents)
      let existingResource = this.find(resource)
      if (existingResource !== undefined) {
        const updateValue: any = {...resource.value}
        const existingValue: any = {...existingResource.value}
        for (const key of Object.keys(updateValue)) {
          if (! ignore.includes(key) && updateValue[key] !== undefined && updateValue[key] !== existingValue[key]) {
            const updatePath = [...parsedPath, YAML.parseDocument(YAML.stringify(key)).contents]
            const update = YAML.parseDocument(YAML.stringify(updateValue[key])).contents
            this.document.setIn(updatePath, update)
          }
        }
      }
      existingResource = this.find(resource)
      if (existingResource !== undefined) {
        const existingValue: any = {...existingResource.value}
        for (const key of Object.keys(existingValue)) {
          if (ignore.includes(key) || existingValue[key] === undefined || isEmpty(YAML.parseDocument(YAML.stringify(existingValue[key])).contents)) {
            this.document.deleteIn([...parsedPath, YAML.parseDocument(YAML.stringify(key)).contents])
          }
        }
      }
    }
  }

  async sync(
    state: State,
    ignoredChanges: Record<string, string[]>
  ): Promise<Config> {
    core.info('Syncing YAML config with TF state...')
    const resourcesInTFState = await state.getYAMLResources()
    const resourcesInConfig = this.getAllResources()

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
      this.update(resource)
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
