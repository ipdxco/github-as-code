import * as YAML from 'yaml'
import {ConfigSchema, pathToYAML} from './schema.js'
import {
  Resource,
  ResourceConstructor,
  ResourceConstructors,
  resourceToPlain
} from '../resources/resource.js'
import diff from 'deep-diff'
import env from '../env.js'
import * as fs from 'fs'
import {jsonEquals, yamlify} from '../utils.js'

export class Config {
  static FromPath(path = `${env.GITHUB_DIR}/${env.GITHUB_ORG}.yml`): Config {
    const source = fs.readFileSync(path, 'utf8')
    return new Config(source)
  }

  constructor(source: string) {
    this._document = YAML.parseDocument(source)
  }

  private _document: YAML.Document
  get document(): YAML.Document {
    return this._document
  }

  get(): ConfigSchema {
    return this._document.toJSON()
  }

  format(): void {
    const schema = this.get()
    const resources = this.getAllResources()
    const resourcePaths = resources.map(r => r.getSchemaPath(schema).join('.'))
    let again = true
    while (again) {
      again = false
      YAML.visit(this._document, {
        Scalar(_, node) {
          if (node.value === undefined || node.value === null) {
            again = true
            return YAML.visit.REMOVE
          }
        },
        Pair(_, node, path) {
          const resourcePath = [...path, node]
            .filter(p => YAML.isPair(p))
            .map(p => (p as YAML.Pair<unknown, unknown>).key)
            .map(k => String(k))
            .join('.')
          if (!resourcePaths.includes(resourcePath)) {
            const isEmpty = node.value === null || node.value === undefined
            const isEmptyScalar =
              YAML.isScalar(node.value) &&
              (node.value.value === undefined ||
                node.value.value === null ||
                node.value.value === '')
            const isEmptyCollection =
              YAML.isCollection(node.value) && node.value.items.length === 0
            if (isEmpty || isEmptyScalar || isEmptyCollection) {
              again = true
              return YAML.visit.REMOVE
            }
          }
        }
      })
    }
    YAML.visit(this._document, {
      Map(_, {items}) {
        items.sort(
          (a: YAML.Pair<unknown, unknown>, b: YAML.Pair<unknown, unknown>) => {
            return JSON.stringify(a.key).localeCompare(JSON.stringify(b.key))
          }
        )
      },
      Seq(_, {items}) {
        items.sort((a: unknown, b: unknown) => {
          return JSON.stringify(a).localeCompare(JSON.stringify(b))
        })
      }
    })
  }

  toString(): string {
    return this._document.toString({
      collectionStyle: 'block',
      singleQuote: false
    })
  }

  save(path = `${env.GITHUB_DIR}/${env.GITHUB_ORG}.yml`): void {
    this.format()
    fs.writeFileSync(path, this.toString())
  }

  getAllResources(): Resource[] {
    const resources = []
    for (const resourceClass of ResourceConstructors) {
      const classResources = this.getResources(resourceClass)
      resources.push(...classResources)
    }
    return resources
  }

  getResources<T extends Resource>(resourceClass: ResourceConstructor<T>): T[] {
    if (ResourceConstructors.includes(resourceClass)) {
      return resourceClass.FromConfig(this.get())
    } else {
      throw new Error(`${resourceClass.name} is not supported`)
    }
  }

  findResource<T extends Resource>(resource: T): T | undefined {
    const schema = this.get()
    return this.getResources(
      resource.constructor as ResourceConstructor<T>
    ).find(r =>
      jsonEquals(r.getSchemaPath(schema), resource.getSchemaPath(schema))
    )
  }

  someResource<T extends Resource>(resource: T): boolean {
    return this.findResource(resource) !== undefined
  }

  // updates the resource if it already exists, otherwise adds it
  addResource<T extends Resource>(
    resource: T,
    canDeleteProperties = false
  ): void {
    const oldResource = this.findResource(resource)
    const path = resource.getSchemaPath(this.get())
    const newValue = resourceToPlain(resource)
    const oldValue = resourceToPlain(oldResource)
    const diffs = diff(oldValue, newValue)
    for (const d of diffs || []) {
      if (d.kind === 'N') {
        this._document.addIn(
          pathToYAML([...path, ...(d.path || [])]),
          yamlify(d.rhs)
        )
      } else if (d.kind === 'E') {
        this._document.setIn(
          pathToYAML([...path, ...(d.path || [])]),
          yamlify(d.rhs)
        )
        const node = this._document.getIn(
          [...path, ...(d.path || [])],
          true
        ) as {comment?: string; commentBefore?: string}
        delete node.comment
        delete node.commentBefore
      } else if (d.kind === 'D' && canDeleteProperties) {
        this._document.deleteIn(pathToYAML([...path, ...(d.path || [])]))
      } else if (d.kind === 'A') {
        if (d.item.kind === 'N') {
          this._document.addIn(
            pathToYAML([...path, ...(d.path || []), d.index]),
            yamlify(d.item.rhs)
          )
        } else if (d.item.kind === 'E') {
          this._document.setIn(
            pathToYAML([...path, ...(d.path || []), d.index]),
            yamlify(d.item.rhs)
          )
          const node = this._document.getIn(
            [...path, ...(d.path || []), d.index],
            true
          ) as {comment?: string; commentBefore?: string}
          delete node.comment
          delete node.commentBefore
        } else if (d.item.kind === 'D') {
          this._document.setIn(
            pathToYAML([...path, ...(d.path || []), d.index]),
            undefined
          )
        } else {
          throw new Error('Nested arrays are not supported')
        }
      }
    }
  }

  removeResource<T extends Resource>(resource: T): void {
    if (this.someResource(resource)) {
      const path = resource.getSchemaPath(this.get())
      this._document.deleteIn(path)
    }
  }

  sync(resources: Resource[]): void {
    const oldResources = []
    for (const resource of ResourceConstructors) {
      oldResources.push(...this.getResources(resource))
    }
    const schema = this.get()
    for (const resource of oldResources) {
      if (
        !resources.some(r =>
          jsonEquals(r.getSchemaPath(schema), resource.getSchemaPath(schema))
        )
      ) {
        this.removeResource(resource)
      }
    }
    for (const resource of resources) {
      this.addResource(resource, true)
    }
  }
}
