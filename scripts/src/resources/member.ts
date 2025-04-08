import {GitHub} from '../github.js'
import {Id, StateSchema} from '../terraform/schema.js'
import env from '../env.js'
import {Path, ConfigSchema} from '../yaml/schema.js'
import {Resource} from './resource.js'

export enum Role {
  Admin = 'admin',
  Member = 'member'
}

export type MemberSchema = {
  type: typeof Member.StateType
  values: {
    username: string
    role: string
  }
}

export class Member extends String implements Resource {
  static StateType = 'github_membership' as const
  static async FromGitHub(_members: Member[]): Promise<[Id, Member][]> {
    const github = await GitHub.getGitHub()
    const invitations = await github.listInvitations()
    const members = await github.listMembers()
    const result: [Id, Member][] = []
    for (const invitation of invitations) {
      if (invitation.role === 'billing_manager') {
        throw new Error(`Member role 'billing_manager' is not supported.`)
      }
      if (invitation.login === null) {
        throw new Error(`Invitation ${invitation.id} has no login`)
      }
      const role = invitation.role === 'admin' ? Role.Admin : Role.Member
      result.push([
        `${env.GITHUB_ORG}:${invitation.login}`,
        new Member(invitation.login, role)
      ])
    }
    for (const member of members) {
      if (member.role === 'billing_manager') {
        throw new Error(`Member role 'billing_manager' is not supported.`)
      }
      if (member.user === null) {
        throw new Error(`Member ${member.url} has no associated user`)
      }
      result.push([
        `${env.GITHUB_ORG}:${member.user.login}`,
        new Member(member.user.login, member.role as Role)
      ])
    }
    return result
  }
  static FromState(state: StateSchema): Member[] {
    const members: Member[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (resource.type === Member.StateType && resource.mode === 'managed') {
          members.push(
            new Member(resource.values.username, resource.values.role as Role)
          )
        }
      }
    }
    return members
  }
  static FromConfig(config: ConfigSchema): Member[] {
    const members: Member[] = []
    if (config.members !== undefined) {
      for (const [role, usernames] of Object.entries(config.members)) {
        for (const username of usernames ?? []) {
          members.push(new Member(username, role as Role))
        }
      }
    }
    return members
  }

  constructor(username: string, role: Role) {
    super(username)
    this._username = username
    this._role = role
  }

  private _username: string
  get username(): string {
    return this._username
  }
  private _role: Role
  get role(): Role {
    return this._role
  }

  getSchemaPath(schema: ConfigSchema): Path {
    const members = schema.members?.[this.role] ?? []
    const index = members.indexOf(this.username)
    return ['members', this.role, index === -1 ? members.length : index]
  }

  getStateAddress(): string {
    return `${Member.StateType}.this["${this.username}"]`
  }
}
