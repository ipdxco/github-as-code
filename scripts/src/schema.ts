import {Expose, Type, Transform, Exclude} from 'class-transformer'
import * as transformer from 'class-transformer'

type TransformFnParams = transformer.TransformFnParams & { parent?: transformer.TransformFnParams }
type TransformFn = (params: TransformFnParams) => any

export type ClassConstructor<T> = transformer.ClassConstructor<T>
interface ClassConstructorWithTransforms<T> extends ClassConstructor<T> {
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
export class File implements Definition {
  static PlainToClassTransform(params: TransformFnParams): any {
    const repository = params.value.repository || params.value._repository || params.parent?.obj?.name
    const file = params.value.file || params.value._file || params.key
    return transformer.plainToClassFromExist(new File(repository, file), params.value, params.options)
  }

  constructor(repository: string, name: string) {
    this._repository = repository
    this._file = name
  }

  private _repository: string
  get repository(): string {
    return this._repository
  }
  private _file: string
  get file(): string {
    return this._file
  }

  @Expose() content?: string
  @Expose() overwrite_on_create?: boolean

  getPath(): string[] {
    return ['repositories', this._repository, 'files', this._file]
  }
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
export class BranchProtection implements Definition {
  static PlainToClassTransform(params: TransformFnParams): any {
    const repository = params.value.repository || params.value._repository || params.parent?.obj?.name
    const pattern = params.value.pattern || params.value._pattern || params.key
    return transformer.plainToClassFromExist(new BranchProtection(repository, pattern), params.value, params.options)
  }

  constructor(repository: string, pattern: string) {
    this._repository = repository
    this._pattern = pattern
  }

  private _repository: string
  private _pattern: string

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

  getPath(): string[] {
    return ['repositories', this._repository, 'branch_protection', this._pattern]
  }
}

@Exclude()
export class RepositoryCollaborator extends String implements Definition {
  static PlainToClassTransform(params: TransformFnParams): any {
    if (typeof params.value === 'string') {
      const username = params.value
      const repository = params.parent?.obj?.repository
      const permission = params.parent!.key
      return new RepositoryCollaborator(username, repository, permission)
    } else {
      const username = params.value.username || params.value._username
      const repository = params.value.repository || params.value._repository
      const permission = params.value.permission || params.value._permission
      return new RepositoryCollaborator(username, repository, permission)
    }
  }
  static InstanceToPlainTransform(params: transformer.TransformFnParams): any {
    return params.value._username
  }

  constructor(username: string, repository: string, permission: string) {
    super(username)
    this._username = username
    this._repository = repository
    this._permission = permission
  }

  private _permission: string
  private _username: string
  private _repository: string

  getPath(): string[] {
    return ['repositories', this._repository, 'collaborators', this._permission]
  }
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
export class RepositoryTeam extends String implements Definition {
  static PlainToClassTransform(params: TransformFnParams): any {
    if (typeof params.value === 'string') {
      const team = params.value
      const repository = params.parent?.obj?.repository
      const permission = params.parent!.key
      return new RepositoryTeam(team, repository, permission)
    } else {
      const team = params.value.team || params.value._team
      const repository = params.value.repository || params.value._repository
      const permission = params.value.permission || params.value._permission
      return new RepositoryTeam(team, repository, permission)
    }
  }
  static InstanceToPlainTransform(params: transformer.TransformFnParams): any {
    return params.value._team
  }

  constructor(team: string, repository: string, permission: string) {
    super(team)
    this._team = team
    this._repository = repository
    this._permission = permission
  }

  private _permission: string
  private _team: string
  private _repository: string

  getPath(): string[] {
    return ['repositories', this._repository, 'teams', this._permission]
  }
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
export class Repository implements Definition {
  static PlainToClassTransform(params: TransformFnParams): any {
    const name = params.value.name || params.value._name || params.key
    return transformer.plainToClassFromExist(new Repository(name), {...params.value, name}, params.options)
  }

  constructor(name: string) {
    this._name = name
  }

  private _name: string

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

  @Expose({toClassOnly: true})
  @Transform(transformFn(RepositoryCollaborators, false))
  collaborators?: RepositoryCollaborators
  @Expose({toClassOnly: true})
  @Transform(transformFn(RepositoryTeams, false))
  teams?: RepositoryTeams
  @Expose({toClassOnly: true})
  @Transform(transformFn(File))
  files?: Record<string, File>
  @Expose({toClassOnly: true})
  @Transform(transformFn(BranchProtection))
  branch_protection?: Record<string, BranchProtection>

  getPath(): string[] {
    return ['repositories', this._name]
  }
}

@Exclude()
export class TeamMember extends String implements Definition {
  static PlainToClassTransform(params: TransformFnParams): any {
    if (typeof params.value === 'string') {
      const username = params.value
      const team = params.parent?.obj?.team
      const role = params.parent!.key
      return new TeamMember(username, team, role)
    } else {
      const username = params.value.username || params.value._username
      const team = params.value.team || params.value._team
      const role = params.value.role || params.value._role
      return new TeamMember(username, team, role)
    }
  }
  static InstanceToPlainTransform(params: transformer.TransformFnParams): any {
    return params.value._username
  }

  constructor(username: string, team: string, role: string) {
    super(username)
    this._username = username
    this._team = team
    this._role = role
  }

  private _role: string
  private _username: string
  private _team: string

  getPath(): string[] {
    return ['teams', this._team, 'members', this._role]
  }
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
export class Team implements Definition {
  static PlainToClassTransform(params: TransformFnParams): any {
    const name = params.value.name || params.value._name || params.key
    return transformer.plainToClassFromExist(new Team(name), {...params.value, name}, params.options)
  }

  constructor(name: string) {
    this._name = name
  }

  private _name: string

  @Expose() create_default_maintainer?: boolean
  @Expose() description?: string
  @Expose() parent_team_id?: string
  @Expose() privacy?: 'closed' | 'secret'

  @Expose({toClassOnly: true})
  @Transform(transformFn(TeamMembers, false))
  members?: TeamMembers

  getPath(): string[] {
    return ['teams', this._name]
  }
}

@Exclude()
export class Member extends String implements Definition {
  static PlainToClassTransform(params: TransformFnParams): any {
    if (typeof params.value === 'string') {
      const username = params.value
      const role = params.parent!.key
      return new Member(username, role)
    } else {
      const username = params.value.username || params.value._username
      const role = params.value.role || params.value._role
      return new Member(username, role)
    }
  }
  static InstanceToPlainTransform(params: transformer.TransformFnParams): any {
    return params.value._username
  }

  constructor(username: string, role: string) {
    super(username)
    this._username = username
    this._role = role
  }

  private _role: string
  get role(): string {
    return this._role
  }
  private _username: string

  getPath(): string[] {
    return ['members', this._role]
  }
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

  get<T extends Definition>(cls: ClassConstructor<T>): T[] {
    switch(cls.name) {
      case `${Member.name}`:
        return Object.values(this.members || {}).flat().filter(v => v !== undefined) as unknown as T[]
      case `${Repository.name}`:
        return Object.values(this.repositories || {}) as unknown as T[]
      case `${RepositoryCollaborator.name}`:
        return Object.values(this.repositories || {}).flatMap(r => Object.values(r.collaborators || {}).flat()).filter(v => v !== undefined) as unknown as T[]
      case `${RepositoryTeam.name}`:
        return Object.values(this.repositories || {}).flatMap(r => Object.values(r.teams || {}).flat()).filter(v => v !== undefined) as unknown as T[]
      case `${BranchProtection.name}`:
        return Object.values(this.repositories || {}).flatMap(r => Object.values(r.branch_protection || {})) as unknown as T[]
      case `${File.name}`:
        return Object.values(this.repositories || {}).flatMap(r => Object.values(r.files || {})) as unknown as T[]
      case `${Team.name}`:
        return Object.values(this.teams || {}) as unknown as T[]
      case `${TeamMember.name}`:
        return Object.values(this.teams || {}).flatMap(r => Object.values(r.members || {}).flat()).filter(v => v !== undefined) as unknown as T[]
      default:
        throw new Error(`Not implemented for ${cls.name}`)
    }
  }

  getAll(): Definition[] {
    return [
      Member,
      Repository,
      RepositoryCollaborator,
      RepositoryTeam,
      BranchProtection,
      File,
      Team,
      TeamMember
    ].flatMap(c => this.get(c as ClassConstructor<Definition>))
  }

  findAll<T extends Definition>(obj: T): T[] {
    return this.get(Object.getPrototypeOf(obj).constructor).filter(o => o.getPath().join('.') === obj.getPath().join('.')) as T[]
  }

  find<T extends Definition>(obj: T): T | undefined {
    return this.findAll(obj).find(o => !(obj instanceof String) || o.toString() === obj.toString())
  }

  findIndex<T extends Definition>(obj: T): number {
    return this.findAll(obj).findIndex(o => !(obj instanceof String) || o.toString() === obj.toString())
  }

  has<T extends Definition>(obj: T): boolean {
    return this.find(obj) !== undefined
  }
}

export const DefinitionClasses = [Member, TeamMember, Team, RepositoryCollaborator, RepositoryTeam, Repository, File, BranchProtection] as const
export type DefinitionClass = typeof DefinitionClasses[number]
export interface Definition {
  getPath(): string[]
}
