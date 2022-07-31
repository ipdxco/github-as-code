import {Expose, Type, Transform, Exclude} from 'class-transformer'
import * as transformer from 'class-transformer'

type TransformFnParams = transformer.TransformFnParams & { parent?: transformer.TransformFnParams }
type TransformFn = (params: TransformFnParams) => any

interface ClassConstructorWithTransforms<T> extends transformer.ClassConstructor<T> {
  PlainToClassTransform?: TransformFn
  InstanceToPlainTransform?: TransformFn
  InstanceToInstanceTransform?: TransformFn
}

export function plainToClass<T, V>(cls: ClassConstructorWithTransforms<T>, plain: V): T {
  return transformFn(cls, false)({value: plain, type: transformer.TransformationType.PLAIN_TO_CLASS, options: {}, key: '', obj: plain})
}

export function instanceToPlain<T>(object: T): any {
  return transformFn(Object.getPrototypeOf(object).constructor, false)({value: object, type: transformer.TransformationType.CLASS_TO_PLAIN, options: {}, key: '', obj: object})
}

function transformFn<T>(cls: ClassConstructorWithTransforms<T>, canMap: boolean = true): TransformFn {
  return (params: TransformFnParams): any => {
    if (params.value !== undefined) {
      function transform(params: TransformFnParams): any {
        switch(params.type) {
          case transformer.TransformationType.PLAIN_TO_CLASS:
            if (cls.PlainToClassTransform !== undefined) {
              return cls.PlainToClassTransform(params)
            } else {
              return transformer.plainToClass(cls, params.value, params.options)
            }
          case transformer.TransformationType.CLASS_TO_PLAIN:
            if (cls.InstanceToPlainTransform !== undefined) {
              return cls.InstanceToPlainTransform(params)
            } else {
              return transformer.instanceToPlain(params.value, params.options)
            }
          case transformer.TransformationType.CLASS_TO_CLASS:
            if (cls.InstanceToInstanceTransform !== undefined) {
              return cls.InstanceToInstanceTransform(params)
            } else {
              return transformer.instanceToInstance(params.value, params.options)
            }
        }
      }
      if (Array.isArray(params.value) && canMap) {
        const result: T[] = [];
        for (const [index, value] of params.value.entries()) {
          const key = index.toString()
          result.push(transform({...params, key, value, obj: params.value, parent: params}))
        }
        return result
      } else if (typeof params.value === 'object' && canMap) {
        const record: Record<string, T> = {};
        for (const [key, value] of Object.entries(params.value)) {
          record[key] = transform({...params, key, value, obj: params.value, parent: params})
        }
        return record
      } else {
        return transform({...params})
      }
    }
  }
}

@Exclude()
export class RepositoryPagesSource {
  @Expose() branch?: string
  @Expose() path?: string
}

@Exclude()
export class RepositoryPages {
  @Type(() => RepositoryPagesSource)
  @Expose()
  source?: RepositoryPagesSource
  @Expose() cname?: string
}

@Exclude()
export class RepositoryTemplate {
  @Expose() owner?: string
  @Expose() repository?: string
}

@Exclude()
export class File {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClass(File, {repository: params.parent?.obj?.name, file: params.key, ...params.value}, params.options)
  }
  static wildcardPath = ['repositories', '*', 'files', '*']

  @Expose({ name: 'repository', toClassOnly: true })
  private _repository?: string
  @Expose({ name: 'file', toClassOnly: true })
  private _file?: string

  @Expose() content?: string
  @Expose() overwrite_on_create?: boolean
}

@Exclude()
export class BranchProtectionRequiredPullRequestReviews {
  @Expose() dismiss_stale_reviews?: boolean
  @Expose() dismissal_restrictions?: string[]
  @Expose() pull_request_bypassers?: string[]
  @Expose() require_code_owner_reviews?: boolean
  @Expose() required_approving_review_count?: number
  @Expose() restrict_dismissals?: boolean
}

@Exclude()
export class BranchProtectionRequiredStatusChecks {
  @Expose() contexts?: string[]
  @Expose() strict?: boolean
}

@Exclude()
export class BranchProtection {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClass(BranchProtection, {repository: params.parent?.obj.name, pattern: params.key, ...params.value}, params.options)
  }
  static wildcardPath = ['repositories', '*', 'branch_protection', '*']

  @Expose({ name: 'repository', toClassOnly: true })
  private _repository?: string
  @Expose({ name: 'pattern', toClassOnly: true})
  private _pattern?: string

  @Expose() allows_deletions?: boolean
  @Expose() allows_force_pushes?: boolean
  @Expose() enforce_admins?: boolean
  @Expose() push_restrictions?: string[]
  @Expose() require_conversation_resolution?: boolean
  @Expose() require_signed_commits?: boolean
  @Expose() required_linear_history?: boolean
  @Type(() => BranchProtectionRequiredPullRequestReviews)
  @Expose()
  required_pull_request_reviews?: BranchProtectionRequiredPullRequestReviews
  @Type(() => BranchProtectionRequiredStatusChecks)
  @Expose()
  required_status_checks?: BranchProtectionRequiredStatusChecks
}

@Exclude()
export class RepositoryCollaborator extends String {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClassFromExist(new RepositoryCollaborator(params.value), {permission: params.parent?.key, username: params.value, repository: params.parent?.obj?.repository, index: params.key}, params.options)
  }
  static InstanceToPlainTransform(params: transformer.TransformFnParams): any {
    return params.value._username
  }
  static wildcardPath = ['repositories', '*', 'collaborators', '*']

  constructor(username: string) {
    super(username)
    this._username = username
  }

  @Expose({ name: 'permission', toClassOnly: true })
  private _permission?: string
  @Expose({ name: 'username', toClassOnly: true })
  private _username?: string
  @Expose({ name: 'repository', toClassOnly: true })
  private _repository?: string
  @Expose({ name: 'index', toClassOnly: true })
  private _index?: string
}

@Exclude()
export class RepositoryCollaborators {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClass(RepositoryCollaborators, {repository: params.obj.name, ...params.value}, params.options)
  }

  @Expose()
  @Transform(transformFn(RepositoryCollaborator))
  admin?: RepositoryCollaborator[]
  @Expose()
  @Transform(transformFn(RepositoryCollaborator))
  maintain?: RepositoryCollaborator[]
  @Expose()
  @Transform(transformFn(RepositoryCollaborator))
  push?: RepositoryCollaborator[]
  @Expose()
  @Transform(transformFn(RepositoryCollaborator))
  triage?: RepositoryCollaborator[]
  @Expose()
  @Transform(transformFn(RepositoryCollaborator))
  pull?: RepositoryCollaborator[]
}

@Exclude()
export class RepositoryTeam extends String {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClassFromExist(new RepositoryTeam(params.value), {permission: params.parent?.key, team: params.value, repository: params.parent?.obj?.repository, index: params.key}, params.options)
  }
  static InstanceToPlainTransform(params: transformer.TransformFnParams): any {
    return params.value._team
  }
  static wildcardPath = ['repositories', '*', 'teams', '*']

  constructor(team: string) {
    super(team)
    this._team = team
  }

  @Expose({ name: 'permission', toClassOnly: true })
  private _permission?: string
  @Expose({ name: 'team', toClassOnly: true })
  private _team?: string
  @Expose({ name: 'repository', toClassOnly: true })
  private _repository?: string
  @Expose({ name: 'index', toClassOnly: true })
  private _index?: string
}

@Exclude()
export class RepositoryTeams {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClass(RepositoryTeams, {repository: params.obj.name, ...params.value}, params.options)
  }

  @Expose()
  @Transform(transformFn(RepositoryTeam))
  admin?: RepositoryTeam[]
  @Expose()
  @Transform(transformFn(RepositoryTeam))
  maintain?: RepositoryTeam[]
  @Expose()
  @Transform(transformFn(RepositoryTeam))
  push?: RepositoryTeam[]
  @Expose()
  @Transform(transformFn(RepositoryTeam))
  triage?: RepositoryTeam[]
  @Expose()
  @Transform(transformFn(RepositoryTeam))
  pull?: RepositoryTeam[]
}

@Exclude()
export class Repository {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClass(Repository, {name: params.key, ...params.value}, params.options)
  }
  static wildcardPath = ['repositories', '*']

  @Expose({ name: 'name', toClassOnly: true })
  private _name?: string

  @Expose() allow_auto_merge?: boolean
  @Expose() allow_merge_commit?: boolean
  @Expose() allow_rebase_merge?: boolean
  @Expose() allow_squash_merge?: boolean
  @Expose() archive_on_destroy?: boolean
  @Expose() archived?: boolean
  @Expose() auto_init?: boolean
  @Expose() default_branch?: string
  @Expose() delete_branch_on_merge?: boolean
  @Expose() description?: string
  @Expose() gitignore_template?: string
  @Expose() has_downloads?: boolean
  @Expose() has_issues?: boolean
  @Expose() has_projects?: boolean
  @Expose() has_wiki?: boolean
  @Expose() homepage_url?: string
  @Expose() ignore_vulnerability_alerts_during_read?: boolean
  @Expose() is_template?: boolean
  @Expose() license_template?: string
  @Type(() => RepositoryPages)
  @Expose()
  pages?: RepositoryPages
  @Type(() => RepositoryTemplate)
  @Expose()
  template?: RepositoryTemplate
  @Expose() topics?: string[]
  @Expose() visibility?: string
  @Expose() vulnerability_alerts?: boolean

  @Expose()
  @Transform(transformFn(RepositoryCollaborators, false))
  collaborators?: RepositoryCollaborators
  @Expose()
  @Transform(transformFn(RepositoryTeams, false))
  teams?: RepositoryTeams
  @Expose()
  @Transform(transformFn(File))
  files?: Record<string, File>
  @Expose()
  @Transform(transformFn(BranchProtection))
  branch_protection?: Record<string, BranchProtection>
}

@Exclude()
export class TeamMember extends String {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClassFromExist(new TeamMember(params.value), {role: params.parent?.key, username: params.value, team: params.parent?.obj.team, index: params.key}, params.options)
  }
  static InstanceToPlainTransform(params: transformer.TransformFnParams): any {
    return params.value._username
  }
  static wildcardPath = ['teams', '*', 'members', '*']

  constructor(username: string) {
    super(username)
    this._username = username
  }

  @Expose({ name: 'role', toClassOnly: true })
  private _role?: string
  @Expose({ name: 'username', toClassOnly: true })
  private _username?: string
  @Expose({ name: 'team', toClassOnly: true })
  private _team?: string
}

@Exclude()
export class TeamMembers {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClass(TeamMembers, {team: params.obj.name, ...params.value}, params.options)
  }

  @Expose()
  @Transform(transformFn(TeamMember))
  maintainer?: TeamMember[]
  @Expose()
  @Transform(transformFn(TeamMember))
  member?: TeamMember[]
}

@Exclude()
export class Team {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClass(Team, {name: params.key, ...params.value}, params.options)
  }
  static wildcardPath = ['teams', '*']

  @Expose({ name: 'name', toClassOnly: true })
  private _name?: string

  @Expose() create_default_maintainer?: boolean
  @Expose() description?: string
  @Expose() parent_team_id?: string
  @Expose() privacy?: 'closed' | 'secret'

  @Expose()
  @Transform(transformFn(TeamMembers, false))
  members?: TeamMembers
}

@Exclude()
export class Member extends String {
  static PlainToClassTransform(params: TransformFnParams): any {
    return transformer.plainToClassFromExist(new Member(params.value), {role: params.parent?.key, username: params.value, index: params.key}, params.options)
  }
  static InstanceToPlainTransform(params: transformer.TransformFnParams): any {
    return params.value._username
  }
  static wildcardPath = ['members', '*']

  constructor(username: string) {
    super(username)
    this._username = username
  }

  @Expose({ name: 'role', toClassOnly: true })
  private _role?: string
  @Expose({ name: 'username', toClassOnly: true })
  private _username?: string
  @Expose({ name: 'index', toClassOnly: true })
  private _index?: number
}

@Exclude()
export class Members {
  @Expose()
  @Transform(transformFn(Member))
  admin?: Member[]
  @Expose()
  @Transform(transformFn(Member))
  member?: Member[]
}

@Exclude()
export class Schema {
  @Expose()
  @Type(() => Members)
  members?: Members
  @Expose()
  @Transform(transformFn(Repository))
  repositories?: Record<string, Repository>
  @Expose()
  @Transform(transformFn(Team))
  teams?: Record<string, Team>
}

export const DefinitionClasses = [Member, TeamMember, Team, RepositoryCollaborator, RepositoryTeam, Repository, File, BranchProtection] as const
export type DefinitionClass = typeof DefinitionClasses[number]
export type Definition = Member | TeamMember | Team | RepositoryCollaborator | RepositoryTeam | Repository | File | BranchProtection
