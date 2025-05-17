import {Exclude, Expose, plainToClassFromExist, Type} from 'class-transformer'
import {GitHub} from '../github.js'
import {Id, StateSchema} from '../terraform/schema.js'
import {Path, ConfigSchema} from '../yaml/schema.js'
import {Resource} from './resource.js'

@Exclude()
class Pattern {
  @Expose() name?: string
  @Expose() negate?: boolean
  @Expose() operator?: 'starts_with' | 'ends_with' | 'contains' | 'regex'
  @Expose() pattern?: string
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
class RequiredCheck {
  @Expose() context?: string
  @Expose() integration_id?: number
}

@Exclude()
class RequiredStatusChecks {
  @Expose() strict_required_status_checks_policy?: boolean

  @Expose()
  @Type(() => Array<RequiredCheck>)
  required_check?: RequiredCheck[]
}

@Exclude()
class RequiredWorkflow {
  @Expose() repository_id?: number
  @Expose() path?: string
  @Expose() ref?: string
}

@Exclude()
class RequiredWorkflows {
  @Expose()
  @Type(() => Array<RequiredWorkflow>)
  required_workflow?: RequiredWorkflow[]
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
  @Type(() => PullRequest)
  pull_request?: PullRequest

  @Expose()
  @Type(() => RequiredStatusChecks)
  required_status_checks?: RequiredStatusChecks

  @Expose()
  @Type(() => RequiredWorkflows)
  required_workflows?: RequiredWorkflows

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
  @Expose() repository_id?: number

  @Expose()
  @Type(() => Filter)
  repository_name?: Filter

  @Expose()
  @Type(() => Filter)
  ref_name?: Filter
}

@Exclude()
export class Ruleset implements Resource {
  static StateType = 'github_organization_ruleset' as const
  static async FromGitHub(_rules: Ruleset[]): Promise<[Id, Ruleset][]> {
    const github = await GitHub.getGitHub()
    const rulesets = await github.listRulesets()
    const result: [Id, Ruleset][] = []
    for (const ruleset of rulesets) {
      result.push([`${ruleset.id}`, new Ruleset(ruleset.name)])
    }
    return result
  }
  static FromState(state: StateSchema): Ruleset[] {
    const rulesets: Ruleset[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === Ruleset.StateType &&
          resource.mode === 'managed'
        ) {
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
            const pull_request = stateRules.pull_request?.at(0)
            const required_status_checks =
              stateRules.required_status_checks?.at(0)
            const required_workflows = stateRules.required_workflows?.at(0)
            const tag_name_pattern = stateRules.tag_name_pattern?.at(0)
            const required_code_scanning =
              stateRules.required_code_scanning?.at(0)
            rules = {
              ...stateRules,
              branch_name_pattern,
              commit_author_email_pattern,
              commit_message_pattern,
              committer_email_pattern,
              pull_request,
              required_status_checks,
              required_workflows,
              tag_name_pattern,
              required_code_scanning
            }
          }
          const stateConditions = resource.values.conditions?.at(0)
          let conditions: Conditions | undefined
          if (stateConditions !== undefined) {
            const repository_name = stateConditions.repository_name?.at(0)
            const ref_name = stateConditions.ref_name?.at(0)
            conditions = {
              ...stateConditions,
              repository_name,
              ref_name
            }
          }
          rulesets.push(
            plainToClassFromExist(new Ruleset(resource.values.name), {
              ...resource.values,
              rules,
              conditions
            })
          )
        }
      }
    }
    return rulesets
  }
  static FromConfig(config: ConfigSchema): Ruleset[] {
    const rulesets: Ruleset[] = []
    if (config.rulesets !== undefined) {
      for (const [name, ruleset] of Object.entries(config.rulesets)) {
        rulesets.push(plainToClassFromExist(new Ruleset(name), ruleset))
      }
    }
    return rulesets
  }

  constructor(name: string) {
    this._name = name
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
    return ['rulesets', this.name]
  }

  getStateAddress(): string {
    return `${Ruleset.StateType}.this["${this.name}"]`
  }
}
