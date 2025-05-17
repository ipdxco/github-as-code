import {instanceToPlain} from 'class-transformer'
import {Id, StateSchema} from '../terraform/schema.js'
import {Path, ConfigSchema} from '../yaml/schema.js'
import {Member} from './member.js'
import {Repository} from './repository.js'
import {RepositoryBranchProtectionRule} from './repository-branch-protection-rule.js'
import {RepositoryCollaborator} from './repository-collaborator.js'
import {RepositoryFile} from './repository-file.js'
import {RepositoryLabel} from './repository-label.js'
import {RepositoryTeam} from './repository-team.js'
import {Team} from './team.js'
import {TeamMember} from './team-member.js'
import {RepositoryRuleset} from './repository-ruleset.js'
import {Ruleset} from './ruleset.js'

export interface Resource {
  // returns YAML config path under which the resource can be found
  // e.g. ['members', 'admin', ]
  getSchemaPath(schema: ConfigSchema): Path
  // returns Terraform state path under which the resource can be found
  // e.g. github_membership.this["galargh"]
  getStateAddress(): string
}

export interface ResourceConstructor<T extends Resource> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  RepositoryRuleset,
  RepositoryBranchProtectionRule,
  RepositoryCollaborator,
  RepositoryFile,
  RepositoryLabel,
  RepositoryTeam,
  Repository,
  TeamMember,
  Team,
  Ruleset
]

export function resourceToPlain<T extends Resource>(
  resource: T | undefined
): string | Record<string, unknown> | undefined {
  if (resource !== undefined) {
    if (resource instanceof String) {
      return resource.toString()
    } else {
      return instanceToPlain(resource, {exposeUnsetFields: false})
    }
  }
}
