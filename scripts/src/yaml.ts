import {Type, Expose} from 'class-transformer'
import * as YAML from 'yaml'

class Resource {
  path!: string[]
  value!: YAML.Scalar | YAML.Pair
}

class RepositoryPagesSource {
  @Expose() branch?: string
  @Expose() path?: string
}

class RepositoryPages {
  @Type(() => RepositoryPagesSource)
  @Expose() source?: RepositoryPagesSource
  @Expose() cname?: string
}

class RepositoryTemplate {
  @Expose() owner?: string
  @Expose() repository?: string
}

class Repository {
  @Expose() allow_auto_merge?: boolean
  @Expose() allow_merge_commit?: boolean
  @Expose() allow_rebase_merge?: boolean
  @Expose() allow_squash_merge?: boolean
  @Expose() archive_on_destroy?: boolean
  @Expose() archived?: boolean
  @Expose() auto_init?: boolean
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
  @Expose() pages?: RepositoryPages
  @Type(() => RepositoryTemplate)
  @Expose() template?: RepositoryTemplate
  @Expose() topics?: string[]
  @Expose() visibility?: string
  @Expose() vulnerability_alerts?: boolean
}

class File {
  @Expose() content?: string
  @Expose() branch?: string
  @Expose() commit_author?: string
  @Expose() commit_email?: string
  @Expose() commit_message?: string
  @Expose() overwrite_on_create?: boolean
}

class BranchProtectionRequiredPullRequestReviews {
  @Expose() dismiss_stale_reviews?: boolean
  @Expose() dismissal_restrictions?: string[]
  @Expose() pull_request_bypassers?: string[]
  @Expose() require_code_owner_reviews?: boolean
  @Expose() required_approving_review_count?: number
  @Expose() restrict_dismissals?: boolean
}

class BranchProtectionRequiredStatusChecks {
  @Expose() contexts?: string[]
  @Expose() strict?: boolean
}

class BranchProtection {
  @Expose() allows_deletions?: boolean
  @Expose() allows_force_pushes?: boolean
  @Expose() enforce_admins?: boolean
  @Expose() push_restrictions?: string[]
  @Expose() require_conversation_resolution?: boolean
  @Expose() require_signed_commits?: boolean
  @Expose() required_linear_history?: boolean
  @Type(() => BranchProtectionRequiredPullRequestReviews)
  @Expose() required_pull_request_reviews?: BranchProtectionRequiredPullRequestReviews
  @Type(() => BranchProtectionRequiredStatusChecks)
  @Expose() required_status_checks?: BranchProtectionRequiredStatusChecks
}

class RepositoryContainer extends Repository {
  collaborators?: {
    admin?: string[]
    maintain?: string[]
    push?: string[]
    triage?: string[]
    pull?: string[]
  }
  teams?: {
    admin?: string[]
    maintain?: string[]
    push?: string[]
    triage?: string[]
    pull?: string[]
  }
  files?: Record<string, File>
  branch_protection?: Record<string, BranchProtection>
}

class Team {
  @Expose() create_default_maintainer?: boolean
  @Expose() description?: string
  @Expose() parent_team_id?: string
  @Expose() privacy?: "closed" | "secret"
}

class TeamContainer extends Team {
  members?: {
    maintainer?: string[],
    member?: string[]
  }
}

export default class Schema {
  members?: {
    admin?: string[]
    member?: string[]
  }
  repositories?: Record<string, RepositoryContainer>
  teams?: Record<string, TeamContainer>
}

class Config {
  document: YAML.Document

  constructor(yaml: string) {
    this.document = YAML.parseDocument(yaml)
  }

  getJSON(): Schema {
    return this.document.toJSON()
  }

  matchIn(path: string[]): Resource[] {
    function _matchIn(path: string[], node: YAML.YAMLMap, history: string[]): Resource[] {
      const [key, ...rest] = path
      return node.items
        .filter(item => {
          return YAML.isScalar(item.key) && new String(item.key.value).match(`^${key}$`)
        })
        .flatMap(item => {
          if (rest.length === 0) {
            if (YAML.isCollection(item.value)) {
              return item.value.items.filter(i => YAML.isScalar(i) || YAML.isPair(i)).map(i => {
                const resource = new Resource()
                resource.path = [...history, new String((item.key as YAML.Scalar).value).toString()]
                resource.value = i as YAML.Scalar | YAML.Pair
                return resource
              })
            } else {
              return []
            }
          } else {
            if (YAML.isMap(item.value)) {
              return _matchIn(rest, item.value, [...history, new String((item.key as YAML.Scalar).value).toString()])
            } else {
              return []
            }
          }
        })
    }
    return _matchIn(path, this.document.contents as YAML.YAMLMap, [])
  }

  find(resource: Resource): Resource | undefined {
    return this.matchIn(resource.path).find(matchingResource => {
      return this.equals(resource.value, matchingResource.value)
    })
  }

  contains(resource: Resource): boolean {
    return this.find(resource) !== undefined
  }

  getResources(): Resource[] {
    return [
      ...this.matchIn(["members", ".+"]),
      ...this.matchIn(["repositories"]),
      ...this.matchIn(["repositories", ".+", "collaborators", ".+"]),
      ...this.matchIn(["repositories", ".+", "teams", ".+"]),
      ...this.matchIn(["repositories", ".+", "files"]),
      ...this.matchIn(["repositories", ".+", "branch_protection"]),
      ...this.matchIn(["teams"]),
      ...this.matchIn(["teams", ".+", "members", ".+"])
    ]
  }

  equals(a: unknown, b: unknown): boolean {
    if (YAML.isScalar(a)) {
      return YAML.isScalar(b) && a.value === b.value
    } else if (YAML.isPair(a)) {
      return YAML.isPair(b) && YAML.isScalar(a.key) && YAML.isScalar(b.key) && a.key.value === b.key.value
    } else {
      return false
    }
  }

  remove(resource: Resource): void {
    const item = this.document.getIn(resource.path)
    if (YAML.isCollection(item)) {
      item.items = item.items.filter(i => {
        return !this.equals(i, resource.value)
      })
    }
  }

  add(resource: Resource): void {
    const parsedPath = resource.path.map(p => YAML.parseDocument(p).contents)
    const item = this.document.getIn(resource.path)
    if (item === undefined) {
      if (YAML.isScalar(resource.value)) {
        this.document.addIn(parsedPath, YAML.parseDocument('[]').contents)
      } else if (YAML.isPair(resource.value)) {
        this.document.addIn(parsedPath, YAML.parseDocument('{}').contents)
      }
    }
    this.document.addIn(parsedPath, resource.value)
  }
}

export { Resource, File, BranchProtection, Repository, Team }

export function parse(yaml: string): Config {
  return new Config(yaml)
}
