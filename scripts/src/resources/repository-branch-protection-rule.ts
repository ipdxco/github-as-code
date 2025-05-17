import {Exclude, Expose, plainToClassFromExist, Type} from 'class-transformer'
import {GitHub} from '../github.js'
import {Id, StateSchema} from '../terraform/schema.js'
import {Path, ConfigSchema} from '../yaml/schema.js'
import {Repository} from './repository.js'
import {Resource} from './resource.js'

@Exclude()
class RequiredPullRequestReviews {
  @Expose() dismiss_stale_reviews?: boolean
  @Expose() dismissal_restrictions?: string[]
  @Expose() pull_request_bypassers?: string[]
  @Expose() require_code_owner_reviews?: boolean
  @Expose() require_last_push_approval?: boolean
  @Expose() required_approving_review_count?: number
  @Expose() restrict_dismissals?: boolean
}

@Exclude()
class RequiredStatusChecks {
  @Expose() contexts?: string[]
  @Expose() strict?: boolean
}

@Exclude()
class RestrictPushes {
  @Expose() blocks_creations?: boolean
  @Expose() push_allowances?: string[]
}

@Exclude()
export class RepositoryBranchProtectionRule implements Resource {
  static StateType = 'github_branch_protection' as const
  static async FromGitHub(
    _rules: RepositoryBranchProtectionRule[]
  ): Promise<[Id, RepositoryBranchProtectionRule][]> {
    const github = await GitHub.getGitHub()
    const rules = await github.listRepositoryBranchProtectionRules()
    const result: [Id, RepositoryBranchProtectionRule][] = []
    for (const rule of rules) {
      result.push([
        `${rule.repository.name}:${rule.branchProtectionRule.pattern}`,
        new RepositoryBranchProtectionRule(
          rule.repository.name,
          rule.branchProtectionRule.pattern
        )
      ])
    }
    return result
  }
  static FromState(state: StateSchema): RepositoryBranchProtectionRule[] {
    const rules: RepositoryBranchProtectionRule[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === RepositoryBranchProtectionRule.StateType &&
          resource.mode === 'managed'
        ) {
          const repositoryIndex: string = resource.index.split(':')[0]
          const repository = state.values.root_module.resources.find(
            r =>
              r.mode === 'managed' &&
              r.type === Repository.StateType &&
              r.index === repositoryIndex
          )
          const required_pull_request_reviews =
            resource.values.required_pull_request_reviews?.at(0)
          const required_status_checks =
            resource.values.required_status_checks?.at(0)
          rules.push(
            plainToClassFromExist(
              new RepositoryBranchProtectionRule(
                repository !== undefined &&
                repository.type === Repository.StateType
                  ? repository.values.name
                  : repositoryIndex,
                resource.values.pattern
              ),
              {
                ...resource.values,
                required_pull_request_reviews,
                required_status_checks
              }
            )
          )
        }
      }
    }
    return rules
  }
  static FromConfig(config: ConfigSchema): RepositoryBranchProtectionRule[] {
    const rules: RepositoryBranchProtectionRule[] = []
    if (config.repositories !== undefined) {
      for (const [repository_name, repository] of Object.entries(
        config.repositories
      )) {
        if (repository.branch_protection !== undefined) {
          for (const [pattern, rule] of Object.entries(
            repository.branch_protection
          )) {
            rules.push(
              plainToClassFromExist(
                new RepositoryBranchProtectionRule(repository_name, pattern),
                rule
              )
            )
          }
        }
      }
    }
    return rules
  }

  constructor(repository: string, pattern: string) {
    this._repository = repository
    this._pattern = pattern
  }

  private _repository: string
  get repository(): string {
    return this._repository
  }
  private _pattern: string
  get pattern(): string {
    return this._pattern
  }

  @Expose() allows_deletions?: boolean
  @Expose() allows_force_pushes?: boolean
  @Expose() enforce_admins?: boolean
  @Expose() force_push_bypassers?: string[]
  @Expose() lock_branch?: boolean
  @Expose() require_conversation_resolution?: boolean
  @Expose() require_signed_commits?: boolean
  @Expose() required_linear_history?: boolean
  @Expose()
  @Type(() => RequiredPullRequestReviews)
  required_pull_request_reviews?: RequiredPullRequestReviews
  @Expose()
  @Type(() => RequiredStatusChecks)
  required_status_checks?: RequiredStatusChecks
  @Expose()
  @Type(() => RestrictPushes)
  restrict_pushes?: RestrictPushes

  getSchemaPath(_schema: ConfigSchema): Path {
    return ['repositories', this.repository, 'branch_protection', this.pattern]
  }

  getStateAddress(): string {
    return `${RepositoryBranchProtectionRule.StateType}.this["${this.repository}:${this.pattern}"]`
  }
}
