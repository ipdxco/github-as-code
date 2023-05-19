import {Exclude, Expose, plainToClassFromExist, Type} from 'class-transformer'
import {GitHub} from '../github'
import {Id, StateSchema} from '../terraform/schema'
import {Path, ConfigSchema} from '../yaml/schema'
import {Resource} from './resource'

@Exclude()
class PageSource {
  @Expose() branch?: string
  @Expose() path?: string
}

@Exclude()
class Pages {
  @Expose() source?: PageSource
  @Expose() cname?: string
}

@Exclude()
class Template {
  @Expose() owner?: string
  @Expose() repository?: string
}

export enum Visibility {
  Private = 'private',
  Public = 'public'
}

@Exclude()
export class Repository implements Resource {
  static StateType: string = 'github_repository'
  static async FromGitHub(
    _repositories: Repository[]
  ): Promise<[Id, Repository][]> {
    const github = await GitHub.getGitHub()
    const repositories = await github.listRepositories()
    const result: [Id, Repository][] = []
    for (const repository of repositories) {
      result.push([repository.name, new Repository(repository.name)])
    }
    return result
  }
  static FromState(state: StateSchema): Repository[] {
    const repositories: Repository[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === Repository.StateType &&
          resource.mode === 'managed'
        ) {
          const pages = {
            ...resource.values.pages?.at(0),
            source: {...resource.values.pages?.at(0)?.source?.at(0)}
          }
          const template = resource.values.template?.at(0)
          const security_and_analysis =
            resource.values.security_and_analysis?.at(0)
          const advanced_security =
            security_and_analysis?.advanced_security?.at(0)?.status ===
            'enabled'
          const secret_scanning =
            security_and_analysis?.secret_scanning?.at(0)?.status === 'enabled'
          const secret_scanning_push_protection =
            security_and_analysis?.secret_scanning_push_protection?.at(0)
              ?.status === 'enabled'
          repositories.push(
            plainToClassFromExist(new Repository(resource.values.name), {
              ...resource.values,
              pages,
              template,
              advanced_security,
              secret_scanning,
              secret_scanning_push_protection
            })
          )
        }
      }
    }
    return repositories
  }
  static FromConfig(config: ConfigSchema): Repository[] {
    const repositories: Repository[] = []
    if (config.repositories !== undefined) {
      for (const [name, repository] of Object.entries(config.repositories)) {
        repositories.push(
          plainToClassFromExist(new Repository(name), repository)
        )
      }
    }
    return repositories
  }

  constructor(name: string) {
    this._name = name
  }

  private _name: string
  get name(): string {
    return this._name
  }

  @Expose() allow_auto_merge?: boolean
  @Expose() allow_merge_commit?: boolean
  @Expose() allow_rebase_merge?: boolean
  @Expose() allow_squash_merge?: boolean
  @Expose() allow_update_branch?: boolean
  @Expose() archive_on_destroy?: boolean
  @Expose() archived?: boolean
  @Expose() auto_init?: boolean
  @Expose() default_branch?: string
  @Expose() delete_branch_on_merge?: boolean
  @Expose() description?: string
  @Expose() gitignore_template?: string
  @Expose() has_discussions?: boolean
  @Expose() has_downloads?: boolean
  @Expose() has_issues?: boolean
  @Expose() has_projects?: boolean
  @Expose() has_wiki?: boolean
  @Expose() homepage_url?: string
  @Expose() ignore_vulnerability_alerts_during_read?: boolean
  @Expose() is_template?: boolean
  @Expose() license_template?: string
  @Expose() merge_commit_message?: string
  @Expose() merge_commit_title?: string
  @Expose()
  @Type(() => Pages)
  pages?: Pages
  // security_and_analysis
  @Expose() advanced_security?: boolean
  @Expose() secret_scanning?: boolean
  @Expose() secret_scanning_push_protection?: boolean
  @Expose() squash_merge_commit_message?: string
  @Expose() squash_merge_commit_title?: string
  @Expose()
  @Type(() => Template)
  template?: Template
  @Expose() topics?: string[]
  @Expose() visibility?: Visibility
  @Expose() vulnerability_alerts?: boolean

  getSchemaPath(_schema: ConfigSchema): Path {
    return new Path('repositories', this.name)
  }

  getStateAddress(): string {
    return `${Repository.StateType}.this["${this.name}"]`
  }
}
