import {Exclude, Expose, plainToClassFromExist, Type} from 'class-transformer'
import {GitHub} from '../github.js'
import {Id, StateSchema} from '../terraform/schema.js'
import {Path, ConfigSchema} from '../yaml/schema.js'
import {Repository} from './repository.js'
import {Resource} from './resource.js'

@Exclude()
class Pattern {
  @Expose() name?: string
  @Expose() negate?: boolean
  @Expose() operator?: 'starts_with' | 'ends_with' | 'contains' | 'regex'
  @Expose() pattern?: string
}

@Exclude()
class MergeQueue {
  @Expose() check_response_timeout_minutes?: number
  @Expose() grouping_strategy?: 'ALLGREEN' | 'HEADGREEN'
  @Expose() max_entries_to_build?: number
  @Expose() max_entries_to_merge?: number
  @Expose() merge_method?: 'MERGE' | 'SQUASH' | 'REBASE'
  @Expose() min_entries_to_merge?: number
  @Expose() min_entries_to_merge_wait_minutes?: number
}

@Exclude()
class PullRequest {
  @Expose() dismiss_stale_reviews_on_push?: boolean
  @Expose() require_code_owner_reviews?: boolean
  @Expose() require_last_push_approval?: boolean
  @Expose() required_approving_review_count?: number
  @Expose() required_review_thread_resolution?: boolean
}

@Exclude()
class RequiredDeployments {
  @Expose() required_deployment_environments?: string[]
}

@Exclude()
class RequiredCheck {
  @Expose() context?: string
  @Expose() integration_id?: number
}

@Exclude()
class RequiredStatusChecks {
  @Expose() strict_required_status_checks_policy?: boolean
  @Expose() do_not_enforce_on_create?: boolean

  @Expose()
  @Type(() => Array<RequiredCheck>)
  required_check?: RequiredCheck[]
}

@Exclude()
class RequiredCodeScanningTool {
  @Expose() alerts_threshold?: 'none' | 'errors' | 'errors_and_warnings' | 'all'
  @Expose() security_alerts_threshold?:
    | 'none'
    | 'critical'
    | 'high_or_higher'
    | 'medium_or_higher'
    | 'all'
  @Expose() tool?: string
}

@Exclude()
class RequiredCodeScanning {
  @Expose()
  @Type(() => Array<RequiredCodeScanningTool>)
  required_code_scanning_tool?: RequiredCodeScanningTool[]
}

@Exclude()
class Rules {
  @Expose() creation?: boolean
  @Expose() deletion?: boolean
  @Expose() non_fast_forward?: boolean
  @Expose() required_linear_history?: boolean
  @Expose() required_signatures?: boolean
  @Expose() update?: boolean
  @Expose() update_allows_fetch_and_merge?: boolean

  @Expose()
  @Type(() => Pattern)
  branch_name_pattern?: Pattern

  @Expose()
  @Type(() => Pattern)
  commit_author_email_pattern?: Pattern

  @Expose()
  @Type(() => Pattern)
  commit_message_pattern?: Pattern

  @Expose()
  @Type(() => Pattern)
  committer_email_pattern?: Pattern

  @Expose()
  @Type(() => MergeQueue)
  merge_queue?: MergeQueue

  @Expose()
  @Type(() => PullRequest)
  pull_request?: PullRequest

  @Expose()
  @Type(() => RequiredDeployments)
  required_deployments?: RequiredDeployments

  @Expose()
  @Type(() => RequiredStatusChecks)
  required_status_checks?: RequiredStatusChecks

  @Expose()
  @Type(() => Pattern)
  tag_name_pattern?: Pattern

  @Expose()
  @Type(() => RequiredCodeScanning)
  required_code_scanning?: RequiredCodeScanning
}

@Exclude()
class BypassActors {
  @Expose() actor_id?: string
  @Expose() actor_type?:
    | 'RepositoryRole' // maintain = 2, write = 4, admin = 5
    | 'Team'
    | 'Integration'
    | 'OrganizationAdmin' // 1
  @Expose() bypass_mode?: 'always' | 'pull_request'
}

@Exclude()
class Filter {
  @Expose() exclude?: boolean
  @Expose() include?: string
}

@Exclude()
class Conditions {
  @Expose()
  @Type(() => Filter)
  ref_name?: Filter
}

@Exclude()
export class RepositoryRuleset implements Resource {
  static StateType = 'github_repository_ruleset' as const
  static async FromGitHub(
    _rules: RepositoryRuleset[]
  ): Promise<[Id, RepositoryRuleset][]> {
    const github = await GitHub.getGitHub()
    const rulesets = await github.listRepositoryRulesets()
    const result: [Id, RepositoryRuleset][] = []
    for (const ruleset of rulesets) {
      result.push([
        `${ruleset.repository.name}:${ruleset.ruleset.id}`,
        new RepositoryRuleset(ruleset.repository.name, ruleset.ruleset.name)
      ])
    }
    return result
  }
  static FromState(state: StateSchema): RepositoryRuleset[] {
    const rulesets: RepositoryRuleset[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === RepositoryRuleset.StateType &&
          resource.mode === 'managed'
        ) {
          const repositoryIndex: string = resource.index.split(':')[0]
          const repository = state.values.root_module.resources.find(
            r =>
              r.mode === 'managed' &&
              r.type === Repository.StateType &&
              r.index === repositoryIndex
          )
          const stateRules = resource.values.rules?.at(0)
          let rules: Rules | undefined
          if (stateRules !== undefined) {
            const branch_name_pattern = stateRules.branch_name_pattern?.at(0)
            const commit_author_email_pattern =
              stateRules.commit_author_email_pattern?.at(0)
            const commit_message_pattern =
              stateRules.commit_message_pattern?.at(0)
            const committer_email_pattern =
              stateRules.committer_email_pattern?.at(0)
            const merge_queue = stateRules.merge_queue?.at(0)
            const pull_request = stateRules.pull_request?.at(0)
            const required_deployments = stateRules.required_deployments?.at(0)
            const required_status_checks =
              stateRules.required_status_checks?.at(0)
            const tag_name_pattern = stateRules.tag_name_pattern?.at(0)
            const required_code_scanning =
              stateRules.required_code_scanning?.at(0)
            rules = {
              ...stateRules,
              branch_name_pattern,
              commit_author_email_pattern,
              commit_message_pattern,
              committer_email_pattern,
              merge_queue,
              pull_request,
              required_deployments,
              required_status_checks,
              tag_name_pattern,
              required_code_scanning
            }
          }
          const stateConditions = resource.values.conditions?.at(0)
          let conditions: Conditions | undefined
          if (stateConditions !== undefined) {
            const ref_name = stateConditions.ref_name?.at(0)
            conditions = {
              ...stateConditions,
              ref_name
            }
          }
          rulesets.push(
            plainToClassFromExist(
              new RepositoryRuleset(
                repository !== undefined &&
                repository.type === Repository.StateType
                  ? repository.values.name
                  : repositoryIndex,
                resource.values.name
              ),
              {
                ...resource.values,
                rules,
                conditions
              }
            )
          )
        }
      }
    }
    return rulesets
  }
  static FromConfig(config: ConfigSchema): RepositoryRuleset[] {
    const rulesets: RepositoryRuleset[] = []
    if (config.repositories !== undefined) {
      for (const [repository_name, repository] of Object.entries(
        config.repositories
      )) {
        if (repository.rulesets !== undefined) {
          for (const [name, ruleset] of Object.entries(repository.rulesets)) {
            rulesets.push(
              plainToClassFromExist(
                new RepositoryRuleset(repository_name, name),
                ruleset
              )
            )
          }
        }
      }
    }
    return rulesets
  }

  constructor(repository: string, name: string) {
    this._repository = repository
    this._name = name
  }

  private _repository: string
  get repository(): string {
    return this._repository
  }
  private _name: string
  get name(): string {
    return this._name
  }

  @Expose() target?: 'branch' | 'tag'
  @Expose() enforcement?: 'disabled' | 'active' | 'evaluate'

  @Expose()
  @Type(() => Rules)
  rules?: Rules
  @Expose()
  @Type(() => Array<BypassActors>)
  bypass_actors?: BypassActors[]
  @Expose()
  @Type(() => Conditions)
  conditions?: Conditions

  getSchemaPath(_schema: ConfigSchema): Path {
    return ['repositories', this.repository, 'rulesets', this.name]
  }

  getStateAddress(): string {
    return `${RepositoryRuleset.StateType}.this["${this.repository}:${this.name}"]`
  }
}
