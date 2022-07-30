import * as YAML from 'yaml'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as tf from './terraform'
import * as schema from './schema'
import {camelCaseToSnakeCase, pathsMatch, env} from './utils'
import jsonpath from 'jsonpath'
import * as transformer from 'class-transformer'

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
    const json = schema.plainToClass(schema.Schema, this.document.toJSON())
    return json
  }

  fmt(managedResourceTypes: string[] = tf.getManagedResourceTypes(), ignoredChanges: Record<string, string[]> = tf.getIgnoredChanges()): void {
    const managedResources = managedResourceTypes.map(t => tf.ManagedResources.find(cls => camelCaseToSnakeCase(cls.name) == t)!)
    const pathsWithIgnoredKeys: [string[], string[]][] = []
    for (const [key, value] of Object.entries(ignoredChanges)) {
      const managedResource = managedResources.find(cls => camelCaseToSnakeCase(cls.name) == key)
      if (managedResource !== undefined) {
        pathsWithIgnoredKeys.push([managedResource.YAMLResourceClass.wildcardPath, value])
      }
    }

    YAML.visit(this.document, {
      Map(_, {items}) {
        items.sort((a: YAML.Pair<unknown, unknown>, b: YAML.Pair<unknown, unknown>) => {
          return JSON.stringify(a.key).localeCompare(JSON.stringify(b.key))
        })
      },
      Seq(_, {items}) {
        items.sort((a: unknown, b: unknown) => {
          return JSON.stringify(a).localeCompare(JSON.stringify(b))
        })
      },
      Pair(_, {key, value}, pathComponents) {
        if (isEmpty(value)) {
          return YAML.visit.REMOVE
        }
        const path = pathComponents.filter(YAML.isPair).map(p => new String(p.key).toString())
        const pathAndIgnoredKeys = pathsWithIgnoredKeys.find(([wildcardPath, _]) => {
          return pathsMatch(path, wildcardPath)
        })
        if (pathAndIgnoredKeys !== undefined && pathAndIgnoredKeys[1].includes(new String(key).toString())) {
          return YAML.visit.REMOVE
        }
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
    const p = jsonpath.stringify(['$', ...path]).replaceAll('["*"]', '[*]')
    return jsonpath.nodes(this.getJSON(), p).flatMap(node => {
      if (node.value !== undefined) {
        return (Array.isArray(node.value) ? node.value : [node.value]).map(v => {
          return new Resource(node.path.slice(1).map(c => c.toString()), v)
        })
      } else {
        return []
      }
    })
    /*
    const matchingResources: Resource[] = []
    YAML.visit(this.document, {
      Map(_, value, pathComponents) {
        const mapPath = pathComponents.filter(YAML.isPair).map(p => new String(p.key).toString())
        if (pathsMatch(mapPath, path)) {
          matchingResources.push(new Resource(mapPath, prototype.fromPlain(value.toJSON())))
        }
      },
      Seq(_, {items}, pathComponents) {
        const seqPath = pathComponents.filter(YAML.isPair).map(p => new String(p.key).toString())
        if (pathsMatch(seqPath, path)) {
          for (const item of items) {
            matchingResources.push(new Resource(seqPath, prototype.fromPlain(item)))
          }
        }
      }
    })
    return matchingResources
    */
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
      } else {
        this.document.deleteIn(resource.path)
      }
    }
  }

  add(resource: Resource): void {
    core.info(`Adding ${JSON.stringify(resource)}`)
    // this turns strings into string Scalars which we need for YAML.Document.addIn to work as expected
    const parsedPath = resource.path.map(p => YAML.parseDocument(p).contents)
    const parsedValue = YAML.parseDocument(YAML.stringify(schema.instanceToPlain(resource.value))).contents
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
      const valueObject: any = schema.instanceToPlain(resource.value)
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

  update(resource: Resource): void {
    core.info(`Updating ${JSON.stringify(resource)}`)
    if (resource.value instanceof String) {
      // do nothing, there's nothing to update in scalar values
    } else {
      const parsedPath = resource.path.map(p => YAML.parseDocument(p).contents)
      let existingResource = this.find(resource)
      if (existingResource !== undefined) {
        const updateValue: any = schema.instanceToPlain(resource.value)
        const existingValue: any = schema.instanceToPlain(existingResource.value)
        for (const key of Object.keys(updateValue)) {
          if (updateValue[key] !== undefined && updateValue[key] !== existingValue[key]) {
            const updatePath = [...parsedPath, YAML.parseDocument(YAML.stringify(key)).contents]
            const update = YAML.parseDocument(YAML.stringify(updateValue[key])).contents
            this.document.setIn(updatePath, update)
          }
        }
      }
    }
  }

  async sync(state: tf.State): Promise<Config> {
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

  save(fmt = true): void {
    if (fmt) {

      this.fmt()
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
