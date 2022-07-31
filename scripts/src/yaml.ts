import * as YAML from 'yaml'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as tf from './terraform'
import * as schema from './schema'
import {camelCaseToSnakeCase, pathsMatch, env} from './utils'

function toNode(value: any): YAML.Node {
  return YAML.parseDocument(YAML.stringify(value)).contents!
}

export class Config {
  document: YAML.Document

  constructor(yaml: string) {
    this.document = YAML.parseDocument(yaml)
  }

  getJSON(): schema.Schema {
    return schema.plainToClass(schema.Schema, this.document.toJSON())
  }

  fmt(managedResourceTypes: string[] = tf.getManagedResourceTypes(), ignoredChanges: Record<string, string[]> = tf.getIgnoredChanges()): void {
    const json = this.getJSON()
    const managedResources = managedResourceTypes.map(t => tf.ManagedResources.find(cls => camelCaseToSnakeCase(cls.name) == t)!)
    for (const [key, value] of Object.entries(ignoredChanges)) {
      const managedResource = managedResources.find(cls => camelCaseToSnakeCase(cls.name) == key)!
      for (const resource of json.get(managedResource.YAMLResourceClass as schema.ClassConstructor<schema.Definition>)!) {
        for (const path of value) {
          this.document.deleteIn([...resource.getPath(), path].map(toNode))
        }
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
      Pair(_, {value}) {
        if (YAML.isScalar(value) && (value.value === undefined || value.value === null || value.value === '')) {
          return YAML.visit.REMOVE
        }
        if (YAML.isCollection(value) && value.items.length === 0) {
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

  remove(resource: schema.Definition): void {
    core.info(`Removing ${JSON.stringify(resource)} from ${resource.getPath().join('.')}`)
    const json = this.getJSON()
    if (json.has(resource)) {
      if (resource instanceof String) {
        this.document.deleteIn([...resource.getPath().map(toNode), json.findIndex(resource)])
      } else {
        this.document.deleteIn(resource.getPath().map(toNode))
      }
    }
  }

  add(resource: schema.Definition): void {
    core.info(`Adding ${JSON.stringify(resource)} at ${resource.getPath().join('.')}`)
    let json = this.getJSON()
    if (! json.has(resource)) {
      if (resource instanceof String) {
        const index = (this.document.getIn(resource.getPath()) as YAML.YAMLSeq | undefined)?.items?.length ?? 0
        this.document.addIn([...resource.getPath().map(toNode), index], toNode(schema.instanceToPlain(resource)))
      } else {
        this.document.addIn(resource.getPath().map(toNode), toNode(schema.instanceToPlain(resource)))
      }
    }
    json = this.getJSON()
    if (! (resource instanceof String)) {
      const currentResource = json.find(resource)!
      const newPlain = schema.instanceToPlain(resource)
      const currentPlain = schema.instanceToPlain(currentResource)
      for (const key of Object.keys(newPlain)) {
        if (newPlain[key] !== undefined && JSON.stringify(newPlain[key]) !== JSON.stringify(currentPlain[key])) {
          if (this.document.hasIn([...resource.getPath(), key].map(toNode))) {
            this.document.setIn([...resource.getPath(), key].map(toNode), toNode(newPlain[key]))
          } else {
            this.document.addIn([...resource.getPath(), key].map(toNode), toNode(newPlain[key]))
          }
        }
      }
    }
  }

  async sync(state: tf.State): Promise<Config> {
    core.info('Syncing YAML config with TF state...')
    const resourcesInTFState = await state.getYAMLResources()
    const resourcesInConfig = this.getJSON().getAll()

    // remove all the resources (from YAML config) that Terraform doesn't know about anymore
    const resourcesToRemove = resourcesInConfig.filter(resource => {
      return !resourcesInTFState.find(r => {
        if (r.constructor === resource.constructor && r.getPath().join('.') === resource.getPath().join('.')) {
          return !(r instanceof String) || r.toString() === resource.toString()
        } else {
          return false
        }
      })
    })
    for (const resource of resourcesToRemove) {
      this.remove(resource)
    }

    // add all the resources (to YAML config)
    const resourcesToAdd = resourcesInTFState
    for (const resource of resourcesToAdd) {
      this.add(resource)
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

export function parse(yaml: string): Config {
  return new Config(yaml)
}

export function getConfig(): Config {
  const yaml = fs
    .readFileSync(`${env.GITHUB_DIR}/${env.GITHUB_ORG}.yml`)
    .toString()
  return parse(yaml)
}
