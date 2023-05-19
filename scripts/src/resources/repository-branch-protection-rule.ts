import {Exclude, Expose, plainToClassFromExist, Type} from 'class-transformer'
import {GitHub} from '../github'
import {Id, StateSchema} from '../terraform/schema'
import {Path, ConfigSchema} from '../yaml/schema'
import {Repository} from './repository'
import {Resource} from './resource'

@Exclude()
class RequiredPullRequestReviews {
  @Expose() dismiss_stale_reviews?: boolean
  @Expose() dismissal_restrictions?: string[]
  @Expose() pull_request_bypassers?: string[]
  @Expose() require_code_owner_reviews?: boolean
  @Expose() required_approving_review_count?: number
  @Expose() restrict_dismissals?: boolean
}

@Exclude()
class RequiredStatusChecks {
  @Expose() contexts?: string[]
  @Expose() strict?: boolean
}

@Exclude()
export class RepositoryBranchProtectionRule implements Resource {
  static StateType = 'github_branch_protection'
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
          const repositoryIndex = resource.index.split(':')[0]
          const repository = state.values.root_module.resources.find(
            (r: any) =>
              r.type === Repository.StateType &&
              resource.mode === 'managed' &&
              r.index === repositoryIndex
          )
          const required_pull_request_reviews =
            resource.values.required_pull_request_reviews?.at(0)
          const required_status_checks =
            resource.values.required_status_checks?.at(0)
          rules.push(
            plainToClassFromExist(
              new RepositoryBranchProtectionRule(
                repository?.values?.name || repositoryIndex,
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
  @Expose() blocks_creations?: boolean
  @Expose() enforce_admins?: boolean
  @Expose() lock_branch?: boolean
  @Expose() push_restrictions?: string[]
  @Expose() require_conversation_resolution?: boolean
  @Expose() require_signed_commits?: boolean
  @Expose() required_linear_history?: boolean
  @Expose()
  @Type(() => RequiredPullRequestReviews)
  required_pull_request_reviews?: RequiredPullRequestReviews
  @Expose()
  @Type(() => RequiredStatusChecks)
  required_status_checks?: RequiredStatusChecks

  getSchemaPath(_schema: ConfigSchema): Path {
    return new Path(
      'repositories',
      this.repository,
      'branch_protection',
      this.pattern
    )
  }

  getStateAddress(): string {
    return `${RepositoryBranchProtectionRule.StateType}.this["${this.repository}:${this.pattern}"]`
  }
}
