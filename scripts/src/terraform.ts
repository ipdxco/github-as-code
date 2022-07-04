import {Type, Transform, plainToClass, ClassConstructor} from 'class-transformer'
import * as Config from './yaml'
import * as YAML from 'yaml'
import * as cli from '@actions/exec'
import * as HCL from 'hcl2-parser'
import * as fs from 'fs'
import {camelCaseToSnakeCase, findFileByContent} from './utils'

const TF_LOCK = process.env.TF_LOCK || true
const TF_WORKING_DIR = '../terraform'
const FILES_DIR = '../files'

interface Identifiable {
  id: string
}

class Resource {
  address!: string
  type!: string
  values!: Identifiable

  equals(other: Resource): boolean {
    return this.address === other.address
  }

  async import() {
    await cli.exec(`terraform import -lock=${TF_LOCK} "${this.address.replaceAll('"', '\\"')}" "${this.values.id.replaceAll('"', '\\"')}"`, undefined, { cwd: TF_WORKING_DIR });
  }

  async remove() {
    await cli.exec(`terraform state rm -lock=${TF_LOCK} "${this.address.replaceAll('"', '\\"')}"`, undefined, { cwd: TF_WORKING_DIR });
  }
}

abstract class ManagedResource extends Resource {
  index!: string
  abstract getYAMLResource(context: State): Config.Resource
}
abstract class DataResource extends Resource {
  getDesiredResources(): DesiredResource[] {
    return []
  }
}
class DesiredResource extends Resource {
  constructor(address: string, values: Identifiable) {
    super()
    this.address = address
    this.type = address.split('.')[0]
    this.values = values
  }
}

class NullResource extends Resource {}

class GithubMembership extends ManagedResource {
  static yamlPath = ["members", ".+"]
  override values!: Identifiable & {
    role: 'admin' | 'member'
    username: string
  }
  override getYAMLResource(context: State): Config.Resource {
    return new Config.Resource(
      this.type,
      ['members', this.values.role],
      YAML.parseDocument(this.values.username).contents as YAML.Scalar
    )
  }
}
class GithubRepository extends ManagedResource {
  static yamlPath = ["repositories"]
  override values!: Identifiable & {
    name: string
  }
  override getYAMLResource(context: State): Config.Resource {
    const value = plainToClass(Config.Repository, this.values, { excludeExtraneousValues: true})
    return new Config.Resource(
      this.type,
      ['repositories'],
      (YAML.parseDocument(YAML.stringify({[this.values.name]: value})).contents as YAML.YAMLMap).items[0] as YAML.Pair
    )
  }
}
class GithubRepositoryCollaborator extends ManagedResource {
  static yamlPath = ["repositories", ".+", "collaborators", ".+"]
  override values!: Identifiable & {
    username: string
    repository: string
    permission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull'
  }
  override getYAMLResource(context: State): Config.Resource {
    return new Config.Resource(
      this.type,
      ['repositories',  this.values.repository, 'collaborators', this.values.permission],
      YAML.parseDocument(this.values.username).contents as YAML.Scalar
    )
  }
}
class GithubRepositoryFile extends ManagedResource {
  static yamlPath = ["repositories", ".+", "files"]
  override values!: Identifiable & {
    branch: string
    file: string
    repository: string
    content: string
  }
  override getYAMLResource(context: State): Config.Resource {
    const values = Object.assign({}, this.values)
    const file = findFileByContent(FILES_DIR, values.content)
    if (file) {
      values.content = file.substring(FILES_DIR.length)
    }
    const value = plainToClass(Config.File, values, { excludeExtraneousValues: true})
    return new Config.Resource(
      this.type,
      ['repositories', this.values.repository, 'files'],
      (YAML.parseDocument(YAML.stringify({[this.values.file]: value})).contents as YAML.YAMLMap).items[0] as YAML.Pair
    )
  }
}
class GithubBranchProtection extends ManagedResource {
  static yamlPath = ["repositories", ".+", "branch_protection"]
  override values!: Identifiable & {
    repository: string
    pattern: string
  }
  override getYAMLResource(context: State): Config.Resource {
    const value = plainToClass(Config.BranchProtection, this.values, { excludeExtraneousValues: true})
    return new Config.Resource(
      this.type,
      ['repositories', this.index.split(':')[0], 'branch_protection'],
      (YAML.parseDocument(YAML.stringify({[this.values.pattern]: value})).contents as YAML.YAMLMap).items[0] as YAML.Pair
    )
  }
}
class GithubTeam extends ManagedResource {
  static yamlPath = ["teams"]
  override values!: Identifiable & {
    name: string
    parent_team_id: string | null
  }
  override getYAMLResource(context: State): Config.Resource {
    const values = Object.assign({}, this.values)
    if (values.parent_team_id) {
      const parentTeam = context.getManagedResources().find(r => r instanceof GithubTeam && values.parent_team_id === r.values.id)
      if (parentTeam) {
        values.parent_team_id = (parentTeam as GithubTeam).values.name
      } else {
        throw new Error(`Expected to find parent team with id: ${values.parent_team_id}`)
      }
    }
    const value = plainToClass(Config.Team, values, { excludeExtraneousValues: true})
    return new Config.Resource(
      this.type,
      ['teams'],
      (YAML.parseDocument(YAML.stringify({[this.values.name]: value})).contents as YAML.YAMLMap).items[0] as YAML.Pair
    )
  }
}
class GithubTeamMembership extends ManagedResource {
  static yamlPath = ["teams", ".+", "members", ".+"]
  override values!: Identifiable & {
    username: string
    role: 'maintainer' | 'member'
  }
  override getYAMLResource(context: State): Config.Resource {
    return new Config.Resource(
      this.type,
      ['teams', this.index.split(':')[0], 'members', this.values.role],
      YAML.parseDocument(this.values.username).contents as YAML.Scalar
    )
  }
}
class GithubTeamRepository extends ManagedResource {
  static yamlPath = ["repositories", ".+", "teams", ".+"]
  override values!: Identifiable & {
    repository: string
    permission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull'
  }
  override getYAMLResource(context: State): Config.Resource {
    return new Config.Resource(
      this.type,
      ['repositories', this.index.split(':')[1], 'teams', this.values.permission],
      YAML.parseDocument(this.values.repository).contents as YAML.Scalar
    )
  }
}
class GithubOrganizationData extends DataResource {
  override values!: Identifiable & {
    login: string,
    members: string[],
  }
  override getDesiredResources(): DesiredResource[] {
    return this.values.members.map(member => {
      const resource = new DesiredResource(
        `github_membership.this["${member}"]`,
        { id: `${this.values.login}:${member}` }
      )
      return resource;
    })
  }
}
class GithubRepositoriesData extends DataResource {
  override values!: Identifiable & {
    names: string[]
  }

  override getDesiredResources(): DesiredResource[] {
    return this.values.names.map(name => {
      const resource = new DesiredResource(
        `github_repository.this["${name}"]`,
        {id: name}
      )
      return resource
    })
  }
}
class GithubCollaboratorsData extends DataResource {
  override values!: Identifiable & {
    collaborator: {
      login: string
    }[],
    repository: string
  }
  override getDesiredResources(): DesiredResource[] {
    return this.values.collaborator.map(collaborator => {
      const resource = new DesiredResource(
        `github_repository_collaborator.this["${this.values.repository}:${collaborator.login}"]`,
        {id: `${this.values.repository}:${collaborator.login}`}
      )
      return resource
    })
  }
}
class GithubRepositoryData extends DataResource {
  override values!: Identifiable & {
    name: string
    branches: {
      name: string
      protected: boolean
    }[]
    default_branch: string
  }
  override getDesiredResources(): DesiredResource[] {
    return this.values.branches
      .filter(branch => branch.protected)
      .map(branch => {
        const resource = new DesiredResource(
          `github_branch_protection.this["${this.values.name}:${branch.name}"]`,
          { id: `${this.values.name}:${branch.name}` }
        )
        return resource
      })
  }
}
class GithubOrganizationTeamsData extends DataResource {
  override values!: Identifiable & {
    teams: {
      id: string
      name: string
      repositories: string[]
      members: string[]
    }[]
  }
  override getDesiredResources(): DesiredResource[] {
    const resources = []
    resources.push(
      ...this.values.teams.map(team => {
        const resource = new DesiredResource(
          `github_team.this["${team.name}"]`,
          {id: team.id}
        )
        return resource
      })
    )
    resources.push(
      ...this.values.teams.flatMap(team => {
        return team.repositories.map(repository => {
          const resource = new DesiredResource(
            `github_team_repository.this["${team.name}:${repository}"]`,
            {id: `${team.id}:${repository}`}
          )
          return resource
        })
      })
    )
    resources.push(
      ...this.values.teams.flatMap(team => {
        return team.members.map(member => {
          const resource = new DesiredResource(
            `github_team_membership.this["${team.name}:${member}"]`,
            {id: `${team.id}:${member}`}
          )
          return resource
        })
      })
    )
    return resources
  }
}
class GithubBranchData extends DataResource {}
class GithubTreeData extends DataResource {
  index!: string
  override values!: Identifiable & {
    entries: {
      path: string
    }[]
  }
}

export const ManagedResources = [
  GithubMembership,
  GithubRepository,
  GithubRepositoryCollaborator,
  GithubRepositoryFile,
  GithubBranchProtection,
  GithubTeam,
  GithubTeamMembership,
  GithubTeamRepository,
]

export const DataResources = [
  GithubOrganizationData,
  GithubRepositoriesData,
  GithubCollaboratorsData,
  GithubRepositoryData,
  GithubOrganizationTeamsData,
  GithubBranchData,
  GithubTreeData,
]

class Module {
  @Transform(({ value, options }) => {
    return (value as any[]).map(v => {
      if (v.type == 'null_resource') {
        return plainToClass(NullResource, v, options);
      } else if (v.mode === 'managed') {
        const cls = ManagedResources.find(cls => camelCaseToSnakeCase(cls.name) === v.type)
        if (cls !== undefined) {
          return plainToClass(cls as ClassConstructor<ManagedResource>, v, options)
        } else {
          throw new Error(`Expected to find a matching class for: ${JSON.stringify(v)}`)
        }
      } else if (v.mode === 'data') {
        const cls = DataResources.find(cls => camelCaseToSnakeCase(cls.name) === `${v.address.split('.')[1]}_data`)
        if (cls !== undefined) {
          return plainToClass(cls as ClassConstructor<DataResource>, v, options)
        } else {
          throw new Error(`Expected to find a matching class for: ${JSON.stringify(v)}`)
        }
      } else {
        throw new Error(`Expected either a null_resource, ManagedResource or a DataResource, got this instead: ${JSON.stringify(v)}`)
      }
    })
  })
  resources!: Resource[]
}

class Values {
  @Type(() => Module)
  root_module!: Module
}

class State {
  @Type(() => Values)
  values!: Values

  getYAMLResources(): Config.Resource[] {
    return this.getManagedResources().map(resource => resource.getYAMLResource(this))
  }

  getDataResources(): DataResource[] {
    return this.values.root_module.resources.filter(
      resource => resource instanceof DataResource
    ) as DataResource[]
  }

  getManagedResources(): ManagedResource[] {
    return this.values.root_module.resources.filter(
      resource => resource instanceof ManagedResource
    ) as ManagedResource[]
  }

  getDesiredResources(): DesiredResource[] {
    return this.getDataResources().flatMap(resource =>
      resource.getDesiredResources()
    )
  }

  getResourcesToImport(managedResourceTypes: string[]): Resource[] {
    const managedResources = this.getManagedResources()
    const desiredResources = this.getDesiredResources()

    const resourcesToImport = desiredResources.filter(desiredResource => {
      return managedResourceTypes.includes(desiredResource.type) && !managedResources.find(managedResource =>
        managedResource.equals(desiredResource)
      )
    })

    return resourcesToImport
  }

  getResourcesToRemove(managedResourceTypes: string[]): Resource[] {
    const managedResources = this.getManagedResources()
    const desiredResources = this.getDesiredResources()

    const resourcesToRemove = managedResources.filter(managedResource => {
      if (! managedResourceTypes.includes(managedResource.type)) {
        return true
      } else if (managedResource instanceof GithubRepositoryFile) {
        return !(
          this.values.root_module.resources.filter(
            resource => resource instanceof GithubTreeData
          ) as GithubTreeData[]
        ).find(
          resource =>
            resource.index ===
              `${managedResource.values.repository}:${managedResource.values.branch}` &&
            resource.values.entries.find(
              entry => entry.path === managedResource.values.file
            )
        )
      } else {
        return !desiredResources.find(desiredResource =>
          desiredResource.equals(managedResource)
        )
      }
    })

    return resourcesToRemove
  }
}

export function parse(json: string): State {
  return plainToClass(State, JSON.parse(json))
}

export async function getWorkspace(): Promise<string> {
  let workspace = '';
  await cli.exec('terraform workspace show', undefined, {
    cwd: TF_WORKING_DIR,
    listeners: { stdout: data => { workspace += data.toString(); } }
  })
  return workspace.trim();
}

export async function refreshState() {
  await cli.exec(`terraform refresh -lock=${TF_LOCK}`, undefined, { cwd: TF_WORKING_DIR })
}

export async function getState(): Promise<State> {
  let json = '';
  await cli.exec('terraform show -json', undefined, {
    cwd: TF_WORKING_DIR,
    listeners: { stdout: data => { json += data.toString(); } },
    silent: true
  });
  return parse(json);
}

type LocalsTF = {
  locals?: {
    resource_types?: string[]
  }
}

export function getManagedResourceTypes(): string[] {
  if (fs.existsSync(`${TF_WORKING_DIR}/locals_override.tf`)) {
    const overrides: LocalsTF = HCL.parseToObject(fs.readFileSync(`${TF_WORKING_DIR}/locals_override.tf`))[0];
    if (overrides.locals !== undefined && overrides.locals.resource_types !== undefined) {
      return overrides.locals.resource_types;
    }
  }
  return HCL.parseToObject(fs.readFileSync(`${TF_WORKING_DIR}/locals.tf`))[0]!.locals!.resource_types;
}

type ResourcesTF = {
  resource?: Record<string, {
    lifecycle?: {
      ignore_changes?: string[]
    }
  }>
}

export function getIgnoredChanges(): Record<string, string[]> {
  const ignoredChanges: Record<string, string[]> = {};
  function _updateIgnoredChanges(resources: ResourcesTF) {
    if (resources.resource) {
      Object.entries(resources.resource).forEach(([name, resource]) => {
        if (resource.lifecycle && resource.lifecycle.ignore_changes) {
          ignoredChanges[name] = resource.lifecycle.ignore_changes;
        }
      })
    }
  }
  const resources: ResourcesTF = HCL.parseToObject(fs.readFileSync(`${TF_WORKING_DIR}/locals.tf`))[0]
  _updateIgnoredChanges(resources)
  if (fs.existsSync(`${TF_WORKING_DIR}/resources_override.tf`)) {
    const overrides: ResourcesTF = HCL.parseToObject(fs.readFileSync(`${TF_WORKING_DIR}/resources_override.tf`))[0];
    _updateIgnoredChanges(overrides)
  }
  return ignoredChanges
}
