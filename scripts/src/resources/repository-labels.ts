import {Exclude, Expose, plainToClassFromExist} from 'class-transformer'
import {Path, ConfigSchema} from '../yaml/schema'
import {Resource} from './resource'
import {GitHub} from '../github'
import {Id, StateSchema} from '../terraform/schema'

@Exclude()
class RepositoryLabel {
  @Expose() color?: string
  @Expose() description?: string
}

@Exclude()
export class RepositoryLabels implements Resource {
  static StateType: string = 'github_issue_labels'
  static async FromGitHub(
    _labels: RepositoryLabels[]
  ): Promise<[Id, RepositoryLabels][]> {
    const github = await GitHub.getGitHub()
    const labels = await github.listRepositoryLabels()
    const result: Record<Id, RepositoryLabels> = {}
    for (const label of labels) {
      const repository =
        result[label.repository.name] ||
        new RepositoryLabels(label.repository.name)
      if (repository.labels === undefined) {
        repository.labels = {}
      }
      repository.labels[label.label.name] = plainToClassFromExist(
        new RepositoryLabel(),
        label.label
      )
      result[label.repository.name] = repository
    }
    return Object.entries(result)
  }
  static FromState(state: StateSchema): RepositoryLabels[] {
    const labels: RepositoryLabels[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === RepositoryLabels.StateType &&
          resource.mode === 'managed'
        ) {
          const repositoryLabels = new RepositoryLabels(
            resource.values.repository
          )
          for (const label of resource.values.label) {
            if (repositoryLabels.labels === undefined) {
              repositoryLabels.labels = {}
            }
            repositoryLabels.labels[label.name] = plainToClassFromExist(
              new RepositoryLabel(),
              label
            )
          }
          labels.push(repositoryLabels)
        }
      }
    }
    return labels
  }
  static FromConfig(config: ConfigSchema): RepositoryLabels[] {
    const labels: RepositoryLabels[] = []
    if (config.repositories !== undefined) {
      for (const [repository_name, repository] of Object.entries(
        config.repositories
      )) {
        if (repository.labels !== undefined) {
          const repositoryLabels = new RepositoryLabels(repository_name)
          for (const [name, label] of Object.entries(repository.labels)) {
            if (repositoryLabels.labels === undefined) {
              repositoryLabels.labels = {}
            }
            repositoryLabels.labels[name] = plainToClassFromExist(
              new RepositoryLabel(),
              label
            )
          }
          labels.push(repositoryLabels)
        }
      }
    }
    return labels
  }
  constructor(repository: string) {
    this._repository = repository
  }

  private _repository: string
  get repository(): string {
    return this._repository
  }

  @Expose() labels?: Record<string, RepositoryLabel>

  getSchemaPath(_schema: ConfigSchema): Path {
    return new Path('repositories', this.repository).unique(false)
  }

  getStateAddress(): string {
    return `${RepositoryLabels.StateType}.this["${this.repository}"]`
  }
}
