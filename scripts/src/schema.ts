
import {Expose, Type} from 'class-transformer'

class RepositoryPagesSource {
  @Expose() branch?: string
  @Expose() path?: string
}

class RepositoryPages {
  @Type(() => RepositoryPagesSource)
  @Expose()
  source?: RepositoryPagesSource
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
  @Expose() default_branch?: string
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
  @Expose()
  pages?: RepositoryPages
  @Type(() => RepositoryTemplate)
  @Expose()
  template?: RepositoryTemplate
  @Expose() topics?: string[]
  @Expose() visibility?: string
  @Expose() vulnerability_alerts?: boolean
}

class File {
  @Expose() content?: string
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
  @Expose()
  required_pull_request_reviews?: BranchProtectionRequiredPullRequestReviews
  @Type(() => BranchProtectionRequiredStatusChecks)
  @Expose()
  required_status_checks?: BranchProtectionRequiredStatusChecks
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
  @Expose() privacy?: 'closed' | 'secret'
}

class TeamContainer extends Team {
  members?: {
    maintainer?: string[]
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

export {Schema, File, BranchProtection, Repository, Team}
