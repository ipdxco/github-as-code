import {instanceToPlain} from 'class-transformer'
import {Id, StateSchema} from '../terraform/schema'
import {Path, ConfigSchema} from '../yaml/schema'
import {Member} from './member'
import {Repository} from './repository'
import {RepositoryBranchProtectionRule} from './repository-branch-protection-rule'
import {RepositoryCollaborator} from './repository-collaborator'
import {RepositoryFile} from './repository-file'
import {RepositoryTeam} from './repository-team'
import {Team} from './team'
import {TeamMember} from './team-member'

export interface Resource {
  getSchemaPath(schema: ConfigSchema): Path
  getStateAddress(): string
}

export interface ResourceConstructor<T extends Resource> {
  new (...args: any[]): T
  FromConfig(config: ConfigSchema): T[]
  FromState(state: StateSchema): T[]
  FromGitHub(resources: T[]): Promise<[Id, Resource][]>
  StateType: string
}

export const ResourceConstructors: ResourceConstructor<Resource>[] = [
  Member,
  RepositoryBranchProtectionRule,
  RepositoryCollaborator,
  RepositoryFile,
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
