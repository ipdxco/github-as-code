import {Type, Expose} from 'class-transformer'
import * as YAML from 'yaml'
import { ManagedResources, State } from './terraform'
import { camelCaseToSnakeCase, env } from './utils'
import * as fs from 'fs'

function equals(a: unknown, b: unknown): boolean {
  if (YAML.isScalar(a) && YAML.isScalar(b)) {
    return a.value === b.value
  } else if (YAML.isPair(a) && YAML.isPair(b) && YAML.isScalar(a.key) && YAML.isScalar(b.key)) {
    return a.key.value === b.key.value
  } else {
    throw new Error(`Expected eiter 2 Scalars or 2 Pairs with Scalar keys, got these instead: ${a} and ${b}`)
  }
}

function isEmpty(a: unknown): boolean {
  if (YAML.isScalar(a)) {
    return a.value === undefined || a.value === null// || a.value === ''
  } else if (YAML.isCollection(a)) {
    return a.items.length === 0
  } else {
    return false
  }
}

class Resource {
  type: string
  path: string[]
  value: YAML.Scalar | YAML.Pair

  constructor(type: string, path: string[], value: YAML.Scalar | YAML.Pair) {
    this.type = type
    this.path = path
    this.value = value
  }

  equals(other: Resource): boolean {
    return this.type === other.type && JSON.stringify(this.path) === JSON.stringify(other.path) && equals(this.value, other.value);
  }
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

  sort(): void {
    YAML.visit(this.document, { Map(_, { items }) { items.sort(new YAML.Schema({ sortMapEntries: true }).sortMapEntries!); } })
  }

  toString(): string {
    return this.document.toString({ collectionStyle: 'block', singleQuote: false })
  }

  matchIn(type: string, path: string[]): Resource[] {
    function _matchIn(path: string[], node: YAML.YAMLMap, history: string[]): Resource[] {
      const [key, ...rest] = path
      return node.items
        .filter(item => {
          if (YAML.isScalar(item.key) && typeof item.key.value === 'string') {
            return item.key.value.match(`^${key}$`)
          } else {
            throw new Error(`Expected a string Scalar, got this instead: ${JSON.stringify(item.key)}`)
          }
        })
        .flatMap(item => {
          const path: string[] = [...history, (item.key as YAML.Scalar).value as string]
          if (rest.length === 0) {
            if (YAML.isCollection(item.value)) {
              return item.value.items.map(i => {
                if (YAML.isScalar(i) || YAML.isPair(i)) {
                  return new Resource(type, path, i)
                } else {
                  throw new Error(`Expected either a Scalar or a Pair, got this instead: ${JSON.stringify(i)}`)
                }
              })
            } else {
              throw new Error(`Expected either a YAMLSeq or YAMLMap, got this instead: ${JSON.stringify(item)}`)
            }
          } else {
            if (YAML.isMap(item.value)) {
              return _matchIn(rest, item.value, path)
            } else {
              throw new Error(`Expected a YAMLMap, got this instead: ${JSON.stringify(item)}`)
            }
          }
        })
    }
    return _matchIn(path, this.document.contents as YAML.YAMLMap, [])
  }

  find(resource: Resource): Resource | undefined {
    return this.matchIn(resource.type, resource.path).find(matchingResource => {
      return equals(resource.value, matchingResource.value)
    })
  }

  contains(resource: Resource): boolean {
    return this.find(resource) !== undefined
  }

  getResources(): Resource[] {
    return ManagedResources.flatMap(cls => {
      return this.matchIn(camelCaseToSnakeCase(cls.name), cls.yamlPath)
    })
  }

  remove(resource: Resource): void {
    if (this.contains(resource)) {
      const item = this.document.getIn(resource.path)
      if (YAML.isCollection(item)) {
        item.items = item.items.filter(i => {
          return !equals(i, resource.value)
        })
      } else {
        throw new Error(`Expected either a YAMLSeq or YAMLMap, got this instead: ${JSON.stringify(item)}`)
      }
    }
  }

  add(resource: Resource): void {
    if (! this.contains(resource)) {
      const parsedPath = resource.path.map(p => YAML.parseDocument(p).contents)
      const item = this.document.getIn(resource.path)
      if (item === undefined) {
        if (YAML.isScalar(resource.value)) {
          this.document.addIn(parsedPath, YAML.parseDocument('[]').contents)
        } else if (YAML.isPair(resource.value)) {
          this.document.addIn(parsedPath, YAML.parseDocument('{}').contents)
        } else {
          throw new Error(`Expected either a Scalar or a Pair, got this instead: ${JSON.stringify(resource.value)}`)
        }
      }
      this.document.addIn(parsedPath, resource.value)
    }
  }

  update(resource: Resource, ignore: string[] = []): void {
    if (YAML.isScalar(resource.value)) {
      // do nothing, there's nothing to update in scalar values
    } else if (YAML.isPair(resource.value) && YAML.isMap(resource.value.value)) {
      const existingResource = this.find(resource)
      if (existingResource !== undefined && YAML.isPair(existingResource.value) && YAML.isMap(existingResource.value.value)) {
        const existingValue = existingResource.value.value
        resource.value.value.items.forEach(item => {
          const existingItem = existingValue.items.find(i => equals(i, item))
          if (existingItem !== undefined) {
            if (JSON.stringify(existingItem.value) !== JSON.stringify(item.value)) {
              existingItem.value = item.value
            } else {
              // do nothing, there's no need to update this item
            }
          } else {
            existingValue.items.push(item)
          }
        })
        existingValue.items = existingValue.items.filter(item => {
          if (YAML.isScalar(item.key) && typeof item.key.value === 'string') {
            return ! ignore.includes(item.key.value) && ! isEmpty(item.value)
          } else {
            throw new Error(`Expected a string Scalar, got this instead: ${JSON.stringify(item.key)}`)
          }
        })
      } else {
        throw new Error(`Expected a YAMLMap inside a Pair, got this instead: ${JSON.stringify(existingResource?.value)}`)
      }
    } else {
      throw new Error(`Expected a YAMLMap inside a Pair, got this instead: ${JSON.stringify(resource.value)}`)
    }
  }

  sync(state: State, ignoredChanges: Record<string, string[]>): Config {
    const resourcesInTFState = state.getManagedResources().map(resource => resource.getYAMLResource(state))
    const resourcesInConfig = this.getResources()

    // remove all the resources (from YAML config) that Terraform doesn't know about anymore
    resourcesInConfig.filter(resource => {
      return !resourcesInTFState.find(r => r.equals(resource))
    }).forEach(resource => {
      this.remove(resource)
    })

    // add all the resources (to YAML config) that YAML config doesn't know about yet
    resourcesInTFState.filter(resource => {
      return !resourcesInConfig.find(r => r.equals(resource))
    }).forEach(resource => {
      this.add(resource)
    })

    // update all the resources (in YAML config) with the values from Terraform state
    resourcesInTFState.forEach(resource => {
      this.update(resource, ignoredChanges[resource.type])
    })

    return this
  }
}

export { Resource, File, BranchProtection, Repository, Team }

export function parse(yaml: string): Config {
  return new Config(yaml)
}

export function getConfig(organization: string): Config {
  const yaml = fs.readFileSync(`${env.GITHUB_DIR}/${organization}.yml`).toString()
  return parse(yaml)
}

export function saveConfig(organization: string, config: Config) {
  config.sort()
  fs.writeFileSync(`${env.GITHUB_DIR}/${organization}.yml`, config.toString())
}
