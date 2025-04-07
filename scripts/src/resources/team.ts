import {Resource} from './resource.js'
import {Path, ConfigSchema} from '../yaml/schema.js'
import {Exclude, Expose, plainToClassFromExist} from 'class-transformer'
import {GitHub} from '../github.js'
import {Id, StateSchema} from '../terraform/schema.js'

export enum Privacy {
  PUBLIC = 'closed',
  PRIVATE = 'secret'
}

@Exclude()
export class Team implements Resource {
  static StateType = 'github_team' as const
  static async FromGitHub(_teams: Team[]): Promise<[Id, Team][]> {
    const github = await GitHub.getGitHub()
    const teams = await github.listTeams()
    const result: [Id, Team][] = []
    for (const team of teams) {
      result.push([`${team.id}`, new Team(team.name)])
    }
    return result
  }
  static FromState(state: StateSchema): Team[] {
    const teams: Team[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (resource.type === Team.StateType && resource.mode === 'managed') {
          let parent_team_id = resource.values.parent_team_id
          if (parent_team_id !== undefined) {
            const parentTeam = state.values.root_module.resources.find(
              r =>
                r.type === Team.StateType &&
                r.mode === 'managed' &&
                `${r.values.id}` === `${parent_team_id}`
            )
            parent_team_id =
              parentTeam !== undefined && parentTeam.type === Team.StateType
                ? parentTeam.values.name
                : undefined
          }
          teams.push(
            plainToClassFromExist(new Team(resource.values.name), {
              ...resource.values,
              parent_team_id
            })
          )
        }
      }
    }
    return teams
  }
  static FromConfig(config: ConfigSchema): Team[] {
    const teams: Team[] = []
    if (config.teams !== undefined) {
      for (const [name, team] of Object.entries(config.teams)) {
        teams.push(plainToClassFromExist(new Team(name), team))
      }
    }
    return teams
  }

  constructor(name: string) {
    this._name = name
  }

  private _name: string
  get name(): string {
    return this._name
  }

  @Expose() create_default_maintainer?: boolean
  @Expose() description?: string
  @Expose() parent_team_id?: string
  @Expose() privacy?: Privacy

  getSchemaPath(_schema: ConfigSchema): Path {
    return ['teams', this.name]
  }

  getStateAddress(): string {
    return `${Team.StateType}.this["${this.name}"]`
  }
}
