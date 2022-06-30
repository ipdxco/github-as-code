import {Type, plainToClass} from 'class-transformer'

interface Identifiable {
  id: string
}

class Resource {
  address!: string
  values!: Identifiable

  equals(other: Resource): boolean {
    if (this instanceof GitHubBranchProtection || other instanceof GitHubBranchProtection) {
      // GitHubBranchProtection is a special case, because it uses 2 different IDs for import and in state
      return this.address === other.address
    } else {
      return this.address === other.address && this.values.id.toString() === other.values.id.toString()
    }
  }
}

abstract class ManagedResource extends Resource {}
abstract class DataResource extends Resource {
  getDesiredResources(): DesiredResource[] {
    return []
  }
}
class DesiredResource extends Resource {}

class GitHubMembership extends ManagedResource {}
class GitHubRepository extends ManagedResource {}
class GitHubRepositoryCollaborator extends ManagedResource {}
class GitHubRepositoryFile extends ManagedResource {
  override values!: Identifiable & {
    branch: string
    file: string
    repository: string
  }
}
class GitHubBranchProtection extends ManagedResource {}
class GitHubTeam extends ManagedResource {}
class GitHubTeamMembership extends ManagedResource {}
class GitHubTeamRepository extends ManagedResource {}
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
