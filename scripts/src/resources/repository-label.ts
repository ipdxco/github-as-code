import {Exclude, Expose, plainToClassFromExist} from 'class-transformer'
import {Path, ConfigSchema} from '../yaml/schema'
import {Resource} from './resource'
import {GitHub} from '../github'
import {Id, StateSchema} from '../terraform/schema'

@Exclude()
export class RepositoryLabel implements Resource {
  static StateType: string = 'github_issue_labels'
  static async FromGitHub(
    _labels: RepositoryLabel[]
  ): Promise<[Id, RepositoryLabel][]> {
    const github = await GitHub.getGitHub()
    const labels = await github.listRepositoryLabels()
    const result: [Id, RepositoryLabel][] = []
    for (const label of labels) {
      result.push([
        label.repository.name,
        plainToClassFromExist(
          new RepositoryLabel(label.repository.name, label.label.name),
          label.label
        )
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
          for (const label of resource.values.label) {
            labels.push(
              plainToClassFromExist(
                new RepositoryLabel(resource.values.repository, label.name),
                label
              )
            )
          }
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
    return new Path('repositories', this.repository, 'labels', this._name)
  }

  getStateAddress(): string {
    return `${RepositoryLabel.StateType}.this["${this.repository}"]`
  }
}
