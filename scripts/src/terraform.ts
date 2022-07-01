import {Type, plainToClass} from 'class-transformer'
import * as Config from './yaml'
import * as YAML from 'yaml'

interface Identifiable {
  id: string
}

class Resource {
  address!: string
  values!: Identifiable

  equals(other: Resource): boolean {
    return this.address === other.address
  }
}

abstract class ManagedResource extends Resource {
  index!: string
  abstract getYAMLResource(): Config.Resource
}
abstract class DataResource extends Resource {
  getDesiredResources(): DesiredResource[] {
    return []
  }
}
class DesiredResource extends Resource {}

class GitHubMembership extends ManagedResource {
  override values!: Identifiable & {
    role: 'admin' | 'member'
    username: string
  }
  override getYAMLResource(): Config.Resource {
    return new Config.Resource(
      ['members', this.values.role],
      YAML.parseDocument(this.values.username).contents as YAML.Scalar
    )
  }
}
class GitHubRepository extends ManagedResource {
  override values!: Identifiable & {
    name: string
  }
  override getYAMLResource(): Config.Resource {
    const value = plainToClass(Config.Repository, this.values, { excludeExtraneousValues: true})
    return new Config.Resource(
      ['repositories'],
      (YAML.parseDocument(YAML.stringify({[this.values.name]: value})).contents as YAML.YAMLMap).items[0] as YAML.Pair
    )
  }
}
class GitHubRepositoryCollaborator extends ManagedResource {
  override values!: Identifiable & {
    username: string
    repository: string
    permission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull'
  }
  override getYAMLResource(): Config.Resource {
    return new Config.Resource(
      ['repositories',  this.values.repository, 'collaborators', this.values.permission],
      YAML.parseDocument(this.values.username).contents as YAML.Scalar
    )
  }
}
class GitHubRepositoryFile extends ManagedResource {
  override values!: Identifiable & {
    branch: string
    file: string
    repository: string
  }
  override getYAMLResource(): Config.Resource {
    const value = plainToClass(Config.File, this.values, { excludeExtraneousValues: true})
    return new Config.Resource(
      ['repositories', this.values.repository, 'files'],
      (YAML.parseDocument(YAML.stringify({[this.values.file]: value})).contents as YAML.YAMLMap).items[0] as YAML.Pair
    )
  }
}
class GitHubBranchProtection extends ManagedResource {
  override values!: Identifiable & {
    repository: string
    pattern: string
  }
  override getYAMLResource(): Config.Resource {
    const value = plainToClass(Config.BranchProtection, this.values, { excludeExtraneousValues: true})
    return new Config.Resource(
      ['repositories', this.index.split(':')[0], 'branch_protection'],
      (YAML.parseDocument(YAML.stringify({[this.values.pattern]: value})).contents as YAML.YAMLMap).items[0] as YAML.Pair
    )
  }
}
class GitHubTeam extends ManagedResource {
  override values!: Identifiable & {
    name: string
  }
  override getYAMLResource(): Config.Resource {
    const value = plainToClass(Config.Team, this.values, { excludeExtraneousValues: true})
    return new Config.Resource(
      ['teams'],
      (YAML.parseDocument(YAML.stringify({[this.values.name]: value})).contents as YAML.YAMLMap).items[0] as YAML.Pair
    )
  }
}
class GitHubTeamMembership extends ManagedResource {
  override values!: Identifiable & {
    username: string
    role: 'maintainer' | 'member'
  }
  override getYAMLResource(): Config.Resource {
    return new Config.Resource(
      ['teams', this.index.split(':')[0], 'members', this.values.role],
      YAML.parseDocument(this.values.username).contents as YAML.Scalar
    )
  }
}
class GitHubTeamRepository extends ManagedResource {
  override values!: Identifiable & {
    repository: string
    permission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull'
  }
  override getYAMLResource(): Config.Resource {
    return new Config.Resource(
      ['repositories', this.index.split(':')[1], 'teams', this.values.permission],
      YAML.parseDocument(this.values.repository).contents as YAML.Scalar
    )
  }
}
class GitHubOrganizationData extends DataResource {
  override values!: Identifiable & {
    login: string,
    members: string[],
  }
  override getDesiredResources(): DesiredResource[] {
    return this.values.members.map(member => {
      const resource = new DesiredResource()
      resource.address = `github_membership.github_membership["${member}"]`
      resource.values = { id: `${this.values.login}:${member}` }
      return resource;
    })
  }
}
class GitHubRepositoriesData extends DataResource {
  override values!: Identifiable & {
    names: string[]
  }

  override getDesiredResources(): DesiredResource[] {
    return this.values.names.map(name => {
      const resource = new DesiredResource()
      resource.address = `github_repository.github_repository["${name}"]`
      resource.values = {id: name}
      return resource
    })
  }
}
class GitHubCollaboratorsData extends DataResource {
  override values!: Identifiable & {
    collaborator: {
      login: string
    }[],
    repository: string
  }
  override getDesiredResources(): DesiredResource[] {
    return this.values.collaborator.map(collaborator => {
      const resource = new DesiredResource()
      resource.address = `github_repository_collaborator.github_repository_collaborator["${this.values.repository}:${collaborator.login}"]`
      resource.values = {id: `${this.values.repository}:${collaborator.login}`}
      return resource
    })
  }
}
class GitHubRepositoryData extends DataResource {
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
        const resource = new DesiredResource()
        resource.address = `github_branch_protection.github_branch_protection["${this.values.name}:${branch.name}"]`
        resource.values = { id: `${this.values.name}:${branch.name}` }
        return resource
      })
  }
}
class GitHubOrganizationTeamsData extends DataResource {
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
        const resource = new DesiredResource()
        resource.address = `github_team.github_team["${team.name}"]`
        resource.values = {id: team.id}
        return resource
      })
    )
    resources.push(
      ...this.values.teams.flatMap(team => {
        return team.repositories.map(repository => {
          const resource = new DesiredResource()
          resource.address = `github_team_repository.github_team_repository["${team.name}:${repository}"]`
          resource.values = {id: `${team.id}:${repository}`}
          return resource
        })
      })
    )
    resources.push(
      ...this.values.teams.flatMap(team => {
        return team.members.map(member => {
          const resource = new DesiredResource()
          resource.address = `github_team_membership.github_team_membership["${team.name}:${member}"]`
          resource.values = {id: `${team.id}:${member}`}
          return resource
        })
      })
    )
    return resources
  }
}
class GitHubBranchData extends DataResource {}
class GitHubTreeData extends DataResource {
  index!: string
  override values!: Identifiable & {
    entries: {
      path: string
    }[]
  }
}
class NullResource extends Resource {}

class Module {
  @Type(() => Resource, {
    discriminator: {
      property: 'name',
      subTypes: [
        {value: GitHubMembership, name: 'github_membership'},
        {value: GitHubRepository, name: 'github_repository'},
        {
          value: GitHubRepositoryCollaborator,
          name: 'github_repository_collaborator'
        },
        {value: GitHubRepositoryFile, name: 'github_repository_file'},
        {value: GitHubBranchProtection, name: 'github_branch_protection'},
        {value: GitHubTeam, name: 'github_team'},
        {value: GitHubTeamMembership, name: 'github_team_membership'},
        {value: GitHubTeamRepository, name: 'github_team_repository'},
        {value: GitHubOrganizationData, name: 'data_github_organization'},
        {value: GitHubRepositoriesData, name: 'data_github_repositories'},
        {value: GitHubCollaboratorsData, name: 'data_github_collaborators'},
        {value: GitHubRepositoryData, name: 'data_github_repository'},
        {
          value: GitHubOrganizationTeamsData,
          name: 'data_github_organization_teams'
        },
        {value: GitHubBranchData, name: 'data_github_branch'},
        {value: GitHubTreeData, name: 'data_github_tree'},
        {value: NullResource, name: 'resources'},
        {value: NullResource, name: 'data'}
      ]
    },
    keepDiscriminatorProperty: true
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
    return this.getManagedResources().map(resource => resource.getYAMLResource())
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

  getResourcesToImport(): Resource[] {
    const managedResources = this.getManagedResources()
    const desiredResources = this.getDesiredResources()

    const resourcesToImport = desiredResources.filter(desiredResource => {
      return !managedResources.find(managedResource =>
        managedResource.equals(desiredResource)
      )
    })

    return resourcesToImport
  }

  getResourcesToRemove(): Resource[] {
    const managedResources = this.getManagedResources()
    const desiredResources = this.getDesiredResources()

    const resourcesToRemove = managedResources.filter(managedResource => {
      if (managedResource instanceof GitHubRepositoryFile) {
        return !(
          this.values.root_module.resources.filter(
            resource => resource instanceof GitHubTreeData
          ) as GitHubTreeData[]
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
