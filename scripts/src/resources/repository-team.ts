import {GitHub} from '../github'
import {Id, StateSchema} from '../terraform/schema'
import {Path, ConfigSchema} from '../yaml/schema'
import {Resource} from './resource'
import {Team} from './team'

export enum Permission {
  Admin = 'admin',
  Maintain = 'maintain',
  Push = 'push',
  Triage = 'triage',
  Pull = 'pull'
}

export class RepositoryTeam extends String implements Resource {
  static StateType: string = 'github_team_repository'
  static async FromGitHub(
    _teams: RepositoryTeam[]
  ): Promise<[Id, RepositoryTeam][]> {
    const github = await GitHub.getGitHub()
    const teams = await github.listTeamRepositories()
    const result: [Id, RepositoryTeam][] = []
    for (const team of teams) {
      result.push([
        `${team.team.id}:${team.repository.name}`,
        new RepositoryTeam(
          team.repository.name,
          team.team.name,
          team.team.permission as Permission
        )
      ])
    }
    return result
  }
  static FromState(state: StateSchema): RepositoryTeam[] {
    const teams: RepositoryTeam[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === RepositoryTeam.StateType &&
          resource.mode === 'managed'
        ) {
          const teamIndex = resource.index.split(`:`).slice(0, -1).join(`:`)
          const team = state.values.root_module.resources.find(
            (r: any) =>
              r.type === Team.StateType &&
              resource.mode === 'managed' &&
              r.index === teamIndex
          )
          teams.push(
            new RepositoryTeam(
              resource.values.repository,
              team.values.name || teamIndex,
              resource.values.permission
            )
          )
        }
      }
    }
    return teams
  }
  static FromConfig(config: ConfigSchema): RepositoryTeam[] {
    const teams: RepositoryTeam[] = []
    if (config.repositories !== undefined) {
      for (const [repository_name, repository] of Object.entries(
        config.repositories
      )) {
        if (repository.teams !== undefined) {
          for (const [permission, team_names] of Object.entries(
            repository.teams
          )) {
            for (const team_name of team_names ?? []) {
              teams.push(
                new RepositoryTeam(
                  repository_name,
                  team_name,
                  permission as Permission
                )
              )
            }
          }
        }
      }
    }
    return teams
  }
  constructor(repository: string, team: string, permission: Permission) {
    super(team)
    this._repository = repository
    this._team = team
    this._permission = permission
  }

  private _repository: string
  get repository(): string {
    return this._repository
  }
  private _team: string
  get team(): string {
    return this._team
  }
  private _permission: Permission
  get permission(): Permission {
    return this._permission
  }

  getSchemaPath(schema: ConfigSchema): Path {
    const teams =
      schema.repositories?.[this.repository]?.teams?.[this.permission] || []
    const index = teams.indexOf(this.team)
    return new Path(
      'repositories',
      this.repository,
      'teams',
      this.permission,
      index === -1 ? teams.length : index
    )
  }

  getStateAddress(): string {
    return `${RepositoryTeam.StateType}.this["${this.team}:${this.repository}"]`
  }
}
