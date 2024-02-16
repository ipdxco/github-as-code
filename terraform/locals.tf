locals {
  organization = terraform.workspace
  config       = yamldecode(file("${path.module}/../github/${local.organization}.yml"))
  state = {
    for resource in jsondecode(file("${path.module}/${local.organization}.tfstate.json")).values.root_module.resources :
    "${resource.mode}.${resource.type}.${resource.name}.${resource.index}" => merge(resource.values, { "index" = resource.index })
  }
  resource_types    = []
  advanced_security = false
  defaults = {
    github_membership = {
      username = null
      role     = null
    }
    github_repository = {
      name                                    = null
      allow_auto_merge                        = null
      allow_merge_commit                      = null
      allow_rebase_merge                      = null
      allow_squash_merge                      = null
      allow_update_branch                     = null
      archive_on_destroy                      = null
      archived                                = null
      auto_init                               = null
      default_branch                          = null
      delete_branch_on_merge                  = null
      description                             = null
      gitignore_template                      = null
      has_discussions                         = null
      has_downloads                           = null
      has_issues                              = null
      has_projects                            = null
      has_wiki                                = null
      homepage_url                            = null
      ignore_vulnerability_alerts_during_read = null
      is_template                             = null
      license_template                        = null
      merge_commit_message                    = null
      merge_commit_title                      = null
      squash_merge_commit_message             = null
      squash_merge_commit_title               = null
      topics                                  = null
      visibility                              = null
      vulnerability_alerts                    = null
      security_and_analysis                   = []
      pages                                   = []
      template                                = []
    }
    github_repository_collaborator = {
      repository = null
      username   = null
      permission = null
    }
    github_branch_protection = {
      pattern                         = null
      repository_id                   = null
      allows_deletions                = null
      allows_force_pushes             = null
      blocks_creations                = null
      enforce_admins                  = null
      lock_branch                     = null
      push_restrictions               = null
      require_conversation_resolution = null
      require_signed_commits          = null
      required_linear_history         = null
      required_pull_request_reviews   = []
      required_status_checks          = []
    }
    github_team = {
      name           = null
      description    = null
      parent_team_id = null
      privacy        = null
    }
    github_team_repository = {
      repository = null
      team_id    = null
      permission = null
    }
    github_team_membership = {
      team_id  = null
      username = null
      role     = null
    }
    github_repository_file = {
      repository          = null
      file                = null
      content             = null
      branch              = null
      overwrite_on_create = null
      commit_author       = null
      commit_email        = null
      commit_message      = null
    }
    github_issue_label = {
      repository  = null
      name        = null
      color       = null
      description = null
    }
  }
}
