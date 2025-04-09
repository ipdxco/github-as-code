import {Id, StateSchema} from './schema.js'
import {
  Resource,
  ResourceConstructors,
  ResourceConstructor
} from '../resources/resource.js'
import env from '../env.js'
import * as cli from '@actions/exec'
import * as fs from 'fs'
import * as core from '@actions/core'
import HCL from 'hcl2-parser'

export async function loadState(): Promise<string> {
  let source = ''
  if (env.TF_EXEC === 'true') {
    core.info('Loading state from Terraform state file')
    await cli.exec('terraform show -json', undefined, {
      cwd: env.TF_WORKING_DIR,
      listeners: {
        stdout: data => {
          source += data.toString()
        }
      },
      silent: true
    })
  } else {
    source = fs
      .readFileSync(`${env.TF_WORKING_DIR}/terraform.tfstate`)
      .toString()
  }
  return source
}

type HCLObject = {
  resource?: {
    [key: string]: {
      this?: {
        lifecycle?: {
          ignore_changes?: string[]
        }[]
      }[]
    }
  }
}[]

export class State {
  static async New(): Promise<State> {
    const state = await import('./state.js')
    return new State(await state.loadState())
  }

  private _ignoredProperties: Record<string, string[]> = {}
  private _state: StateSchema

  private updateIgnoredPropertiesFrom(path: string): void {
    if (fs.existsSync(path)) {
      const hcl: HCLObject | undefined = HCL.parseToObject(
        fs.readFileSync(path)
      )
      for (const [name, resource] of Object.entries(
        hcl?.at(0)?.resource ?? {}
      )) {
        const properties = resource?.this
          ?.at(0)
          ?.lifecycle?.at(0)?.ignore_changes
        if (properties !== undefined) {
          this._ignoredProperties[name] = properties.map((v: string) =>
            v.substring(2, v.length - 1)
          ) // '${v}' -> 'v'
        }
      }
    }
  }

  private getState(source: string): StateSchema {
    const state: StateSchema = JSON.parse(source, (_k, v) => v ?? undefined)
    if (state.values?.root_module?.resources !== undefined) {
      state.values.root_module.resources = state.values.root_module.resources
        .filter(r => r.mode === 'managed')
        // .filter(r => !this._ignoredTypes.includes(r.type))
        .map(r => {
          // TODO: remove nested values
          r.values = Object.fromEntries(
            Object.entries(r.values).filter(
              ([k, _v]) => !this._ignoredProperties[r.type]?.includes(k)
            )
          ) as typeof r.values
          return r
        })
    }
    return state
  }

  constructor(source: string) {
    this.updateIgnoredPropertiesFrom(`${env.TF_WORKING_DIR}/resources.tf`)
    this.updateIgnoredPropertiesFrom(
      `${env.TF_WORKING_DIR}/resources_override.tf`
    )
    this._state = this.getState(source)
  }

  async reset(): Promise<void> {
    const state = await import('./state.js')
    this._state = this.getState(await state.loadState())
  }

  async refresh(): Promise<void> {
    if (env.TF_EXEC === 'true') {
      await cli.exec(
        `terraform apply -refresh-only -auto-approve -lock=${env.TF_LOCK}`,
        undefined,
        {
          cwd: env.TF_WORKING_DIR
        }
      )
    }
    await this.reset()
  }

  getAllAddresses(): string[] {
    const addresses = []
    for (const resourceClass of ResourceConstructors) {
      const classAddresses = this.getAddresses(resourceClass)
      addresses.push(...classAddresses)
    }
    return addresses
  }

  getAddresses<T extends Resource>(
    resourceClass: ResourceConstructor<T>
  ): string[] {
    if (ResourceConstructors.includes(resourceClass)) {
      return (this._state?.values?.root_module?.resources ?? [])
        .filter(r => r.type === resourceClass.StateType)
        .map(r => r.address)
    } else {
      throw new Error(`${resourceClass.name} is not supported`)
    }
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
      return resourceClass.FromState(this._state)
    } else {
      throw new Error(`${resourceClass.name} is not supported`)
    }
  }

  async isIgnored<T extends Resource>(
    resourceClass: ResourceConstructor<T>
  ): Promise<boolean> {
    const {Locals} = await import('./locals.js')
    return !Locals.getLocals().resource_types.includes(resourceClass.StateType)
  }

  async addResource(id: Id, resource: Resource): Promise<void> {
    await this.addResourceAt(id, resource.getStateAddress().toLowerCase())
  }

  async addResourceAt(id: Id, address: string): Promise<void> {
    if (env.TF_EXEC === 'true') {
      await cli.exec(
        `terraform import -lock=${env.TF_LOCK} "${address.replaceAll(
          '"',
          '\\"'
        )}" "${id}"`,
        undefined,
        {cwd: env.TF_WORKING_DIR}
      )
    }
  }

  async removeResource(resource: Resource): Promise<void> {
    await this.removeResourceAt(resource.getStateAddress().toLowerCase())
  }

  async removeResourceAt(address: string): Promise<void> {
    if (env.TF_EXEC === 'true') {
      await cli.exec(
        `terraform state rm -lock=${env.TF_LOCK} "${address.replaceAll(
          '"',
          '\\"'
        )}"`,
        undefined,
        {cwd: env.TF_WORKING_DIR}
      )
    }
  }

  async sync(resources: [Id, Resource][]): Promise<void> {
    const addresses = this.getAllAddresses()
    for (const address of addresses) {
      if (
        !resources.some(
          ([_, r]) => r.getStateAddress().toLowerCase() === address
        )
      ) {
        await this.removeResourceAt(address)
      }
    }
    for (const [id, resource] of resources) {
      if (
        !addresses.some(a => a === resource.getStateAddress().toLowerCase())
      ) {
        await this.addResource(id, resource)
      }
    }
  }
}
