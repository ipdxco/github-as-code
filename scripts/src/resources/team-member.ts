import {GitHub} from '../github'
import {Id, StateSchema} from '../terraform/schema'
import {Path, ConfigSchema} from '../yaml/schema'
import {Resource} from './resource'
import {Team} from './team'

export enum Role {
  Maintainer = 'maintainer',
  Member = 'member'
}

export class TeamMember extends String implements Resource {
  static StateType: string = 'github_team_membership'
  static async FromGitHub(_members: TeamMember[]): Promise<[Id, TeamMember][]> {
    const github = await GitHub.getGitHub()
    const invitations = await github.listTeamInvitations()
    const members = await github.listTeamMembers()
    const result: [Id, TeamMember][] = []
    for (const invitation of invitations) {
      const member = _members.find(
        m =>
          m.team === invitation.team.name &&
          m.username === invitation.invitation.login!
      )
      result.push([
        `${invitation.team.id}:${invitation.invitation.login}`,
        new TeamMember(
          invitation.team.name,
          invitation.invitation.login!,
          member?.role || Role.Member
        )
      ])
    }
    for (const member of members) {
      result.push([
        `${member.team.id}:${member.member.login}`,
        new TeamMember(
          member.team.name,
          member.member.login,
          member.membership.role as Role
        )
      ])
    }
    return result
  }
  static FromState(state: StateSchema): TeamMember[] {
    const members: TeamMember[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === TeamMember.StateType &&
          resource.mode === 'managed'
        ) {
          const teamIndex = resource.index.split(`:`).slice(0, -1).join(`:`)
          const team = state.values.root_module.resources.find(
            (r: any) =>
              r.type === Team.StateType &&
              resource.mode === 'managed' &&
              r.index === teamIndex
          )
          members.push(
            new TeamMember(
              team.values.name || teamIndex,
              resource.values.username,
              resource.values.role
            )
          )
        }
      }
    }
    return members
  }
  static FromConfig(config: ConfigSchema): TeamMember[] {
    const members: TeamMember[] = []
    if (config.teams !== undefined) {
      for (const [team_name, team] of Object.entries(config.teams)) {
        if (team.members !== undefined) {
          for (const [role, usernames] of Object.entries(team.members)) {
            for (const username of usernames ?? []) {
              members.push(new TeamMember(team_name, username, role as Role))
            }
          }
        }
      }
    }
    return members
  }

  constructor(team: string, username: string, role: Role) {
    super(username)
    this._team = team
    this._username = username
    this._role = role
  }

  private _team: string
  get team(): string {
    return this._team
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
    const members = schema.teams?.[this.team]?.members?.[this.role] || []
    const index = members.indexOf(this.username)
    return new Path(
      'teams',
      this.team,
      'members',
      this.role,
      index === -1 ? members.length : index
    )
  }

  getStateAddress(): string {
    return `${TeamMember.StateType}.this["${this.team}:${this.username}"]`
  }
}
