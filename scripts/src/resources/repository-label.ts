import {Exclude, Expose, plainToClassFromExist} from 'class-transformer'
import {Path, ConfigSchema} from '../yaml/schema.js'
import {Resource} from './resource.js'
import {GitHub} from '../github.js'
import {Id, StateSchema} from '../terraform/schema.js'

@Exclude()
export class RepositoryLabel implements Resource {
  static StateType = 'github_issue_label' as const
  static async FromGitHub(
    _labels: RepositoryLabel[]
  ): Promise<[Id, RepositoryLabel][]> {
    const github = await GitHub.getGitHub()
    const labels = await github.listRepositoryLabels()
    const result: [Id, RepositoryLabel][] = []
    for (const label of labels) {
      result.push([
        `${label.repository.name}:${label.label.name}`,
        new RepositoryLabel(label.repository.name, label.label.name)
      ])
    }
    return result
  }
  static FromState(state: StateSchema): RepositoryLabel[] {
    const labels: RepositoryLabel[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === RepositoryLabel.StateType &&
          resource.mode === 'managed'
        ) {
          labels.push(
            plainToClassFromExist(
              new RepositoryLabel(
                resource.values.repository,
                resource.values.name
              ),
              resource.values
            )
          )
        }
      }
    }
    return labels
  }
  static FromConfig(config: ConfigSchema): RepositoryLabel[] {
    const labels: RepositoryLabel[] = []
    if (config.repositories !== undefined) {
      for (const [repository_name, repository] of Object.entries(
        config.repositories
      )) {
        if (repository.labels !== undefined) {
          for (const [name, label] of Object.entries(repository.labels)) {
            labels.push(
              plainToClassFromExist(
                new RepositoryLabel(repository_name, name),
                label
              )
            )
          }
        }
      }
    }
    return labels
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

  @Expose() color?: string
  @Expose() description?: string

  getSchemaPath(_schema: ConfigSchema): Path {
    return ['repositories', this.repository, 'labels', this.name]
  }

  getStateAddress(): string {
    return `${RepositoryLabel.StateType}.this["${this.repository}:${this.name}"]`
  }
}
