import {instanceToPlain} from 'class-transformer'
import {Id, StateSchema} from '../terraform/schema'
import {Path, ConfigSchema} from '../yaml/schema'
import {Member} from './member'
import {Repository} from './repository'
import {RepositoryBranchProtectionRule} from './repository-branch-protection-rule'
import {RepositoryCollaborator} from './repository-collaborator'
import {RepositoryFile} from './repository-file'
import {RepositoryLabel} from './repository-label'
import {RepositoryTeam} from './repository-team'
import {Team} from './team'
import {TeamMember} from './team-member'

export interface Resource {
  // returns an unique YAML config path under which the resource can be found
  // e.g. ['members', 'admin', 'galargh']
  getSchemaPath(schema: ConfigSchema): Path
  // returns Terraform state path under which the resource can be found
  // e.g. github_membership.this["galargh"]
  getStateAddress(): string
}

export interface ResourceConstructor<T extends Resource> {
  new (...args: any[]): T
  // extracts all resources of specific type from the given YAML config
  FromConfig(config: ConfigSchema): T[]
  // extracts all resources of specific type from the given Terraform state
  FromState(state: StateSchema): T[]
  // retrieves all resources of specific type from GitHub API
  // it takes a list of resources of the same type as an argument
  // an implementation can choose to ignore it or use it to only check if given resources still exist
  // this is the case with repository files for example where we don't want to manage ALL the files thorugh GitHub Management
  FromGitHub(resources: T[]): Promise<[Id, Resource][]>
  StateType: string
}

export const ResourceConstructors: ResourceConstructor<Resource>[] = [
  Member,
  RepositoryBranchProtectionRule,
  RepositoryCollaborator,
  RepositoryFile,
  RepositoryLabel,
  RepositoryTeam,
  Repository,
  TeamMember,
  Team
]

export function resourceToPlain<T extends Resource>(
  resource: T | undefined
): string | Record<string, any> | undefined {
  if (resource !== undefined) {
    if (resource instanceof String) {
      return resource.toString()
    } else {
      return instanceToPlain(resource, {exposeUnsetFields: false})
    }
  }
}
