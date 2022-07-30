import * as HCL from 'hcl2-parser'
import * as cli from '@actions/exec'
import * as cfg from './yaml'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as schema from './schema'
import * as transformer from 'class-transformer'
import {GitHub} from './github'
import {Transform, Type} from 'class-transformer'
import {camelCaseToSnakeCase, env, findFileByContent} from './utils'

interface Identifiable {
  id: string
}

abstract class Resource {
  address!: string
  type!: string
  values!: Identifiable

  equals(other: Resource): boolean {
    return this.address === other.address
  }

  async import(): Promise<void> {
    core.info(`Importing ${JSON.stringify(this)}`)
    if (env.TF_EXEC) {
      await cli.exec(
        `terraform import -lock=${env.TF_LOCK} "${this.address
          .toString()
          .replaceAll('"', '\\"')}" "${this.values.id
          .toString()
          .replaceAll('"', '\\"')}"`,
        undefined,
        {cwd: env.TF_WORKING_DIR}
      )
    }
  }

  async remove(): Promise<void> {
    core.info(`Removing ${JSON.stringify(this)}`)
    if (env.TF_EXEC) {
      await cli.exec(
        `terraform state rm -lock=${env.TF_LOCK} "${this.address
          .toString()
          .replaceAll('"', '\\"')}"`,
        undefined,
        {cwd: env.TF_WORKING_DIR}
      )
    }
  }
}

abstract class ManagedResource extends Resource {
  index!: string
  abstract getYAMLResource(context: State): Promise<cfg.Resource>
}
class DesiredResource extends Resource {
  constructor(address: string, id: string) {
    super()
    this.address = address
    this.type = address.split('.')[0]
    this.values = {
      id
    }
  }
}

export class GithubMembership extends ManagedResource {
  static YAMLResourceClass = schema.Member
  static async getDesiredResources(
    _context: cfg.Config
  ): Promise<DesiredResource[]> {
    const github = await GitHub.getGitHub()
    const members = await github.listMembers()
    return members.map(member => {
      return new DesiredResource(
        `github_membership.this["${member.login}"]`,
        `${env.GITHUB_ORG}:${member.login}`
      )
    })
  }
  override values!: Identifiable & {
    role: 'admin' | 'member'
    username: string
  }
  override async getYAMLResource(_context: State): Promise<cfg.Resource> {
    const value = GithubMembership.YAMLResourceClass.fromPlain(this.values.username)
    return new cfg.Resource(
      ['members', this.values.role],
      value
    )
  }
}
export class GithubRepository extends ManagedResource {
  static YAMLResourceClass = schema.Repository
  static async getDesiredResources(
    _context: cfg.Config
  ): Promise<DesiredResource[]> {
    const github = await GitHub.getGitHub()
    const repositories = await github.listRepositories()
    return repositories.map(repository => {
      return new DesiredResource(
        `github_repository.this["${repository.name}"]`,
        repository.name
      )
    })
  }
  override values!: Identifiable & {
    name: string
    template: {}[] | {}
    pages:
      | {
          source: {}[] | {}
        }[]
      | {source?: {}}
  }
  override async getYAMLResource(_context: State): Promise<cfg.Resource> {
    const values = {...this.values}
    values.pages = {...((values.pages as {}[])?.at(0) || {})}
    if (values.pages.source) {
      values.pages.source = (values.pages.source as {}[])?.at(0) || {}
    }
    values.template = (values.template as {}[])?.at(0) || {}
    const value = GithubRepository.YAMLResourceClass.fromPlain(values)
    return new cfg.Resource(
      ['repositories', this.values.name],
      value
    )
  }
}
export class GithubRepositoryCollaborator extends ManagedResource {
  static YAMLResourceClass = schema.RepositoryCollaborator
  static async getDesiredResources(
    _context: cfg.Config
  ): Promise<DesiredResource[]> {
    const github = await GitHub.getGitHub()
    const repositoryCollaborators = await github.listRepositoryCollaborators()
    return repositoryCollaborators.map(({repository, collaborator}) => {
      return new DesiredResource(
        `github_repository_collaborator.this["${repository.name}:${collaborator.login}"]`,
        `${repository.name}:${collaborator.login}`
      )
    })
  }
  override values!: Identifiable & {
    username: string
    repository: string
    permission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull'
  }
  override async getYAMLResource(_context: State): Promise<cfg.Resource> {
    const value = GithubRepositoryCollaborator.YAMLResourceClass.fromPlain(this.values.username)
    return new cfg.Resource(
      [
        'repositories',
        this.values.repository,
        'collaborators',
        this.values.permission
      ],
      value
    )
  }
}
export class GithubRepositoryFile extends ManagedResource {
  static YAMLResourceClass = schema.File
  static async getDesiredResources(
    context: cfg.Config
  ): Promise<DesiredResource[]> {
    const repositoryFiles = []
    for (const resource of context.getResources(schema.File)) {
      const repository = resource.path[1]
      const path = resource.path[-1]
      const github = await GitHub.getGitHub()
      const file = await github.getRepositoryFile(repository, path)
      if (file) {
        repositoryFiles.push({repository: resource.path[1], file})
      }
    }
    return repositoryFiles.map(({repository, file}) => {
      return new DesiredResource(
        `github_repository_file.this["${repository}/${file.path}"]`,
        `${repository}/${file.path}:${(file.url.match(/ref=([^&]*)/) || [])[1]}`
      )
    })
  }
  override values!: Identifiable & {
    file: string
    repository: string
    content: string
  }
  override async getYAMLResource(_context: State): Promise<cfg.Resource> {
    const values = {...this.values}
    const file = findFileByContent(env.FILES_DIR, values.content)
    if (file) {
      values.content = file.substring(env.FILES_DIR.length + 1)
    }
    const value = GithubRepositoryFile.YAMLResourceClass.fromPlain(values)
    return new cfg.Resource(
      ['repositories', this.values.repository, 'files', this.values.file],
      value
    )
  }
}
export class GithubBranchProtection extends ManagedResource {
  static YAMLResourceClass = schema.BranchProtection
  static async getDesiredResources(
    _context: cfg.Config
  ): Promise<DesiredResource[]> {
    const github = await GitHub.getGitHub()
    const repositoryBranchProtectionRules =
      await github.listRepositoryBranchProtectionRules()
    return repositoryBranchProtectionRules.map(
      ({repository, branchProtectionRule}) => {
        return new DesiredResource(
          `github_branch_protection.this["${repository.name}:${branchProtectionRule.pattern}"]`,
          `${repository.name}:${branchProtectionRule.pattern}`
        )
      }
    )
  }
  override values!: Identifiable & {
    repository: string
    pattern: string
    required_pull_request_reviews: {}[]
    required_status_checks: {}[]
  }
  override async getYAMLResource(_context: State): Promise<cfg.Resource> {
    const values: any = {...this.values} // eslint-disable-line @typescript-eslint/no-explicit-any
    if (
      values.required_pull_request_reviews &&
      values.required_pull_request_reviews.length
    ) {
      values.required_pull_request_reviews =
        values.required_pull_request_reviews[0]
    } else {
      delete values.required_pull_request_reviews
    }
    if (values.required_status_checks && values.required_status_checks.length) {
      values.required_status_checks = values.required_status_checks[0]
    } else {
      delete values.required_status_checks
    }
    const value = GithubBranchProtection.YAMLResourceClass.fromPlain(values)
    return new cfg.Resource(
      ['repositories', this.index.split(':')[0], 'branch_protection', this.values.pattern],
      value
    )
  }
}
export class GithubTeam extends ManagedResource {
  static YAMLResourceClass = schema.Team
  static async getDesiredResources(
    _context: cfg.Config
  ): Promise<DesiredResource[]> {
    const github = await GitHub.getGitHub()
    const teams = await github.listTeams()
    return teams.map(team => {
      return new DesiredResource(
        `github_team.this["${team.name}"]`,
        team.id.toString()
      )
    })
  }
  override values!: Identifiable & {
    name: string
    parent_team_id: string | null
  }
  override async getYAMLResource(_context: State): Promise<cfg.Resource> {
    const values = {...this.values}
    if (values.parent_team_id) {
      const github = await GitHub.getGitHub()
      const teams = await github.listTeams()
      const parentTeam = teams.find(team => {
        return team.id.toString() === values.parent_team_id?.toString()
      })
      if (parentTeam) {
        values.parent_team_id = parentTeam.name
      } else {
        throw new Error(
          `Expected to find parent team with id: ${values.parent_team_id}`
        )
      }
    }
    const value = GithubTeam.YAMLResourceClass.fromPlain(values)
    return new cfg.Resource(
      ['teams', this.values.name],
      value
    )
  }
}
export class GithubTeamMembership extends ManagedResource {
  static YAMLResourceClass = schema.TeamMember
  static async getDesiredResources(
    _context: cfg.Config
  ): Promise<DesiredResource[]> {
    const github = await GitHub.getGitHub()
    const teamMembers = await github.listTeamMembers()
    return teamMembers.map(({team, member}) => {
      return new DesiredResource(
        `github_team_membership.this["${team.name}:${member.login}"]`,
        `${team.id}:${member.login}`
      )
    })
  }
  override values!: Identifiable & {
    username: string
    role: 'maintainer' | 'member'
  }
  override async getYAMLResource(_context: State): Promise<cfg.Resource> {
    const value = GithubTeamMembership.YAMLResourceClass.fromPlain(this.values.username)
    return new cfg.Resource(
      // team names, unlike usernames or repository names, allow : in them
      [
        'teams',
        this.index.split(':').slice(0, -1).join(':'),
        'members',
        this.values.role
      ],
      value
    )
  }
}
export class GithubTeamRepository extends ManagedResource {
  static YAMLResourceClass = schema.RepositoryTeam
  static async getDesiredResources(
    _context: cfg.Config
  ): Promise<DesiredResource[]> {
    const github = await GitHub.getGitHub()
    const teamRepositories = await github.listTeamRepositories()
    return teamRepositories.map(({team, repository}) => {
      return new DesiredResource(
        `github_team_repository.this["${team.name}:${repository.name}"]`,
        `${team.id}:${repository.name}`
      )
    })
  }
  override values!: Identifiable & {
    repository: string
    permission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull'
  }
  override async getYAMLResource(_context: State): Promise<cfg.Resource> {
    const value = GithubTeamRepository.YAMLResourceClass.fromPlain(this.index.split(':')[0])
    return new cfg.Resource(
      ['repositories', this.values.repository, 'teams', this.values.permission],
      value
    )
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
  GithubTeamRepository
]

class Module {
  @Transform(({value, options}) => {
    return (value as {mode: string, type: string}[]).map(v => {
      const cls = ManagedResources.find(
        c => camelCaseToSnakeCase(c.name) === v.type
      )
      if (v.mode === 'managed' && cls !== undefined) {
        return transformer.plainToClass(
          cls as transformer.ClassConstructor<ManagedResource>,
          v,
          options
        )
      } else {
        return transformer.plainToClass(
          Resource as transformer.ClassConstructor<Resource>,
          v,
          options
        )
      }
    })
  })
  resources!: Resource[]
}

class Values {
  @Type(() => Module)
  root_module!: Module
}

export class State {
  @Type(() => Values)
  values!: Values

  async getYAMLResources(): Promise<cfg.Resource[]> {
    const yamlResources = []
    for (const managedResource of this.getManagedResources()) {
      yamlResources.push(await managedResource.getYAMLResource(this))
    }
    return yamlResources
  }

  getManagedResources(): ManagedResource[] {
    return this.values.root_module.resources.filter(
      resource => resource instanceof ManagedResource
    ) as ManagedResource[]
  }

  async getDesiredResources(context: cfg.Config): Promise<DesiredResource[]> {
    const desiredResources = []
    for (const cls of ManagedResources) {
      desiredResources.push(...(await cls.getDesiredResources(context)))
    }
    return desiredResources
  }

  async getResourcesToImport(
    config: cfg.Config,
    managedResourceTypes: string[]
  ): Promise<Resource[]> {
    const managedResources = this.getManagedResources()
    const desiredResources = await this.getDesiredResources(config)

    const resourcesToImport = desiredResources.filter(desiredResource => {
      return (
        managedResourceTypes.includes(desiredResource.type) &&
        !managedResources.find(managedResource =>
          managedResource.equals(desiredResource)
        )
      )
    })

    return resourcesToImport
  }

  async getResourcesToRemove(
    config: cfg.Config,
    managedResourceTypes: string[]
  ): Promise<Resource[]> {
    const managedResources = this.getManagedResources()
    const desiredResources = await this.getDesiredResources(config)

    const resourcesToRemove = managedResources.filter(managedResource => {
      if (!managedResourceTypes.includes(managedResource.type)) {
        return true
      } else {
        return !desiredResources.find(desiredResource =>
          desiredResource.equals(managedResource)
        )
      }
    })

    return resourcesToRemove
  }

  async sync(
    config: cfg.Config,
    managedResourceTypes: string[]
  ): Promise<State> {
    core.info('Syncing TF state with GitHub...')
    // remove all the resources (from Terraform state) that GitHub doesn't know about anymore
    for (const resource of await this.getResourcesToRemove(
      config,
      managedResourceTypes
    )) {
      await resource.remove()
    }

    // import all the resources (to Terraform state) that Terraform doesn't know about yet
    for (const resource of await this.getResourcesToImport(
      config,
      managedResourceTypes
    )) {
      await resource.import()
    }

    return await getState()
  }
}

export function parse(json: string): State {
  // turns an unstructured JSON object into a State class instance
  return transformer.plainToClass(State, JSON.parse(json))
}

export async function refreshState(): Promise<void> {
  if (env.TF_EXEC) {
    await cli.exec(`terraform refresh -lock=${env.TF_LOCK}`, undefined, {
      cwd: env.TF_WORKING_DIR
    })
  }
}

export async function getState(): Promise<State> {
  let json = ''
  if (env.TF_EXEC) {
    await cli.exec('terraform show -json', undefined, {
      cwd: env.TF_WORKING_DIR,
      listeners: {
        stdout: data => {
          json += data.toString()
        }
      },
      silent: true
    })
  } else {
    json = fs.readFileSync(`${env.TF_WORKING_DIR}/terraform.tfstate`).toString()
  }
  return parse(json)
}

type LocalsTF = {
  locals?: {
    resource_types?: string[]
  }[]
}

export function getManagedResourceTypes(): string[] {
  // tries to get locals.resource_types from locals_override first
  // falls back to locals
  if (fs.existsSync(`${env.TF_WORKING_DIR}/locals_override.tf`)) {
    const overrides: LocalsTF = HCL.parseToObject(
      fs.readFileSync(`${env.TF_WORKING_DIR}/locals_override.tf`)
    )[0]
    if (
      overrides.locals !== undefined &&
      overrides.locals[0]?.resource_types !== undefined
    ) {
      return overrides.locals[0].resource_types
    }
  }
  return HCL.parseToObject(
    fs.readFileSync(`${env.TF_WORKING_DIR}/locals.tf`)
  )[0].locals[0].resource_types
}

type ResourcesTF = {
  resource?: Record<
    string,
    {
      this?: {
        lifecycle?: {
          ignore_changes?: string[]
        }[]
      }[]
    }
  >
}

export function getIgnoredChanges(): Record<string, string[]> {
  const ignoredChanges: Record<string, string[]> = {}
  function _updateIgnoredChanges(resources: ResourcesTF): void {
    if (resources.resource) {
      for (const [name, resource] of Object.entries(resources.resource)) {
        if (
          resource.this &&
          resource.this[0].lifecycle &&
          resource.this[0].lifecycle[0].ignore_changes
        ) {
          ignoredChanges[name] =
            resource.this[0].lifecycle[0].ignore_changes.map(change =>
              change.substring(2, change.length - 1)
            )
        }
      }
    }
  }
  // reads resources first so that values from resources_override can override them
  const resources: ResourcesTF = HCL.parseToObject(
    fs.readFileSync(`${env.TF_WORKING_DIR}/resources.tf`)
  )[0]
  _updateIgnoredChanges(resources)
  if (fs.existsSync(`${env.TF_WORKING_DIR}/resources_override.tf`)) {
    const overrides: ResourcesTF = HCL.parseToObject(
      fs.readFileSync(`${env.TF_WORKING_DIR}/resources_override.tf`)
    )[0]
    _updateIgnoredChanges(overrides)
  }
  return ignoredChanges
}
