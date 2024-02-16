resource "github_membership" "this" {
  for_each = {
    for item in [
      for member, config in local.resources.config.github_membership.this : {
        source = "config"
        index = member
      }
    ] : item.index => item.source
  }

  username = local.resources[each.value].github_membership.this[each.key].username
  role     = local.resources[each.value].github_membership.this[each.key].role

  lifecycle {
    ignore_changes  = []
    prevent_destroy = true
  }
}

resource "github_repository" "this" {
  for_each = {
    for item in [
      for repository, config in local.resources.config.github_repository.this :
        try(config.archived, false) ? {
          source = "state"
          index = repository
        } : {
          source = "config"
          index = repository
        }
    ] : item.index => item.source
  }

  name                                    = local.resources[each.value].github_repository.this[each.key].name
  allow_auto_merge                        = try(local.resources[each.value].github_repository.this[each.key].allow_auto_merge, null)
  allow_merge_commit                      = try(local.resources[each.value].github_repository.this[each.key].allow_merge_commit, null)
  allow_rebase_merge                      = try(local.resources[each.value].github_repository.this[each.key].allow_rebase_merge, null)
  allow_squash_merge                      = try(local.resources[each.value].github_repository.this[each.key].allow_squash_merge, null)
  allow_update_branch                     = try(local.resources[each.value].github_repository.this[each.key].allow_update_branch, null)
  archive_on_destroy                      = try(local.resources[each.value].github_repository.this[each.key].archive_on_destroy, null)
  archived                                = try(local.resources[each.value].github_repository.this[each.key].archived, null)
  auto_init                               = try(local.resources[each.value].github_repository.this[each.key].auto_init, null)
  default_branch                          = try(local.resources[each.value].github_repository.this[each.key].default_branch, null)
  delete_branch_on_merge                  = try(local.resources[each.value].github_repository.this[each.key].delete_branch_on_merge, null)
  description                             = try(local.resources[each.value].github_repository.this[each.key].description, null)
  gitignore_template                      = try(local.resources[each.value].github_repository.this[each.key].gitignore_template, null)
  has_discussions                         = try(local.resources[each.value].github_repository.this[each.key].has_discussions, null)
  has_downloads                           = try(local.resources[each.value].github_repository.this[each.key].has_downloads, null)
  has_issues                              = try(local.resources[each.value].github_repository.this[each.key].has_issues, null)
  has_projects                            = try(local.resources[each.value].github_repository.this[each.key].has_projects, null)
  has_wiki                                = try(local.resources[each.value].github_repository.this[each.key].has_wiki, null)
  homepage_url                            = try(local.resources[each.value].github_repository.this[each.key].homepage_url, null)
  ignore_vulnerability_alerts_during_read = try(local.resources[each.value].github_repository.this[each.key].ignore_vulnerability_alerts_during_read, null)
  is_template                             = try(local.resources[each.value].github_repository.this[each.key].is_template, null)
  license_template                        = try(local.resources[each.value].github_repository.this[each.key].license_template, null)
  merge_commit_message                    = try(local.resources[each.value].github_repository.this[each.key].merge_commit_message, null)
  merge_commit_title                      = try(local.resources[each.value].github_repository.this[each.key].merge_commit_title, null)
  squash_merge_commit_message             = try(local.resources[each.value].github_repository.this[each.key].squash_merge_commit_message, null)
  squash_merge_commit_title               = try(local.resources[each.value].github_repository.this[each.key].squash_merge_commit_title, null)
  topics                                  = try(local.resources[each.value].github_repository.this[each.key].topics, null)
  visibility                              = try(local.resources[each.value].github_repository.this[each.key].visibility, null)
  vulnerability_alerts                    = try(local.resources[each.value].github_repository.this[each.key].vulnerability_alerts, null)

  dynamic "security_and_analysis" {
    for_each = try(local.resources[each.value].github_repository.this[each.key].security_and_analysis, [])

    content {
      dynamic "advanced_security" {
        for_each = security_and_analysis.value["advanced_security"]
        content {
          status = advanced_security.value["status"]
        }
      }
      dynamic "secret_scanning" {
        for_each = security_and_analysis.value["secret_scanning"]
        content {
          status = secret_scanning.value["status"]
        }
      }
      dynamic "secret_scanning_push_protection" {
        for_each = security_and_analysis.value["secret_scanning_push_protection"]
        content {
          status = secret_scanning_push_protection.value["status"]
        }
      }
    }
  }

  dynamic "pages" {
    for_each = try(local.resources[each.value].github_repository.this[each.key].pages, [])
    content {
      cname = try(pages.value["cname"], null)
      dynamic "source" {
        for_each = pages.value["source"]
        content {
          branch = source.value["branch"]
          path   = try(source.value["path"], null)
        }
      }
    }
  }
  dynamic "template" {
    for_each = try(local.resources[each.value].github_repository.this[each.key].template, [])
    content {
      owner      = template.value["owner"]
      repository = template.value["repository"]
    }
  }

  lifecycle {
    ignore_changes  = []
    prevent_destroy = true
  }
}

resource "github_repository_collaborator" "this" {
  for_each = {
    for item in [
      for repository, config in local.resources.config.github_repository.this : flatten([
        try(config.archived, false) ? [
          for member, config in local.resources.state.github_repository_collaborator.this : {
            source = "state"
            index = member
          } if try(regex("^${repository}:", member), null) != null
        ] : [
          for member, config in local.resources.config.github_repository_collaborator.this : {
            source = "config"
            index = member
          } if try(regex("^${repository}:", member), null) != null
        ]
      ])
    ] : item.index => item.source
  }

  depends_on = [github_repository.this]

  repository = local.resources[each.value].github_repository_collaborator.this[each.key].repository
  username   = local.resources[each.value].github_repository_collaborator.this[each.key].username
  permission = local.resources[each.value].github_repository_collaborator.this[each.key].permission

  lifecycle {
    ignore_changes = []
  }
}

resource "github_branch_protection" "this" {
  for_each = {
    for item in [
      for repository, config in local.resources.config.github_repository.this : flatten([
        try(config.archived, false) ? [
          for branch_protection, config in local.resources.state.github_branch_protection.this : {
            source = "state"
            index = branch_protection
          } if try(regex("^${repository}:", branch_protection), null) != null
        ] : [
          for branch_protection, config in local.resources.config.github_branch_protection.this : {
            source = "config"
            index = branch_protection
          } if try(regex("^${repository}:", branch_protection), null) != null
        ]
      ])
    ] : item.index => item.source
  }

  depends_on = [github_repository.this]

  pattern                         = local.resources[each.value].github_branch_protection.this[each.key].pattern

  repository_id = try(local.resources[each.value].github_branch_protection.this[each.key].repository_id, github_repository.this[lower(local.resources[each.value].github_branch_protection.this[each.key].repository)].node_id)

  allows_deletions                = try(local.resources[each.value].github_branch_protection.this[each.key].allows_deletions, null)
  allows_force_pushes             = try(local.resources[each.value].github_branch_protection.this[each.key].allows_force_pushes, null)
  blocks_creations                = try(local.resources[each.value].github_branch_protection.this[each.key].blocks_creations, null)
  enforce_admins                  = try(local.resources[each.value].github_branch_protection.this[each.key].enforce_admins, null)
  lock_branch                     = try(local.resources[each.value].github_branch_protection.this[each.key].lock_branch, null)
  push_restrictions               = try(local.resources[each.value].github_branch_protection.this[each.key].push_restrictions, null)
  require_conversation_resolution = try(local.resources[each.value].github_branch_protection.this[each.key].require_conversation_resolution, null)
  require_signed_commits          = try(local.resources[each.value].github_branch_protection.this[each.key].require_signed_commits, null)
  required_linear_history         = try(local.resources[each.value].github_branch_protection.this[each.key].required_linear_history, null)

  dynamic "required_pull_request_reviews" {
    for_each = try(local.resources[each.value].github_branch_protection.this[each.key].required_pull_request_reviews, [])
    content {
      dismiss_stale_reviews           = try(required_pull_request_reviews.value["dismiss_stale_reviews"], null)
      dismissal_restrictions          = try(required_pull_request_reviews.value["dismissal_restrictions"], null)
      pull_request_bypassers          = try(required_pull_request_reviews.value["pull_request_bypassers"], null)
      require_code_owner_reviews      = try(required_pull_request_reviews.value["require_code_owner_reviews"], null)
      required_approving_review_count = try(required_pull_request_reviews.value["required_approving_review_count"], null)
      restrict_dismissals             = try(required_pull_request_reviews.value["restrict_dismissals"], null)
    }
  }
  dynamic "required_status_checks" {
    for_each = try(local.resources[each.value].github_branch_protection.this[each.key].required_status_checks, null)
    content {
      contexts = try(required_status_checks.value["contexts"], null)
      strict   = try(required_status_checks.value["strict"], null)
    }
  }
}

resource "github_team" "this" {
  for_each = {
    for item in [
      for team, config in local.resources.config.github_team.this : {
        source = "config"
        index = team
      }
    ] : item.index => item.source
  }

  name           = local.resources[each.value].github_team.this[each.key].name

  parent_team_id = try(try(element(data.github_organization_teams.this[0].teams, index(data.github_organization_teams.this[0].teams.*.name, local.resources[each.value].github_team.this[each.key].parent_team_id)).id, local.resources[each.value].github_team.this[each.key].parent_team_id), null)

  description    = try(local.resources[each.value].github_team.this[each.key].description, null)
  privacy        = try(local.resources[each.value].github_team.this[each.key].privacy, null)

  lifecycle {
    ignore_changes = []
  }
}

resource "github_team_repository" "this" {
  for_each = {
    for item in [
      for repository, config in local.resources.config.github_repository.this : flatten([
        try(config.archived, false) ? [
          for team, config in local.resources.state.github_team_repository.this : {
            source = "state"
            index = team
          } if try(regex(":${repository}$", team), null) != null
        ] : [
          for team, config in local.resources.config.github_team_repository.this : {
            source = "config"
            index = team
          } if try(regex(":${repository}$", team), null) != null
        ]
      ])
    ] : item.index => item.source
  }

  depends_on = [github_team.this, github_repository.this]

  repository = local.resources[each.value].github_team_repository.this[each.key].repository
  permission = local.resources[each.value].github_team_repository.this[each.key].permission

  team_id = try(local.resources[each.value].github_team_repository.this[each.key].team_id, github_team.this[lower(local.resources[each.value].github_team_repository.this[each.key].team)].id)

  lifecycle {
    ignore_changes = []
  }
}

resource "github_team_membership" "this" {
  for_each = {
    for item in [
      for member, config in local.resources.config.github_team_membership.this : {
        source = "config"
        index = member
      }
    ] : item.index => item.source
  }

  depends_on = [github_team.this]

  username = local.resources[each.value].github_team_membership.this[each.key].username
  role     = local.resources[each.value].github_team_membership.this[each.key].role

  team_id = try(local.resources[each.value].github_team_membership.this[each.key].team_id, github_team.this[lower(local.resources[each.value].github_team_membership.this[each.key].team)].id)

  lifecycle {
    ignore_changes = []
  }
}

resource "github_repository_file" "this" {
  for_each = {
    for item in [
      for repository, config in local.resources.config.github_repository.this : flatten([
        try(config.archived, false) ? [
          for file, config in local.resources.state.github_repository_file.this : {
            source = "state"
            index = file
          } if try(regex("^${repository}/", file), null) != null
        ] : [
          for file, config in local.resources.config.github_repository_file.this : {
            source = try(local.resources.state.github_repository_file.this[file].content, "") == try(config.content, "") ? "state" : "config"
            index = file
          } if try(regex("^${repository}/", file), null) != null
        ]
      ])
    ] : item.index => item.source
  }

  depends_on = [github_repository.this]

  repository = local.resources[each.value].github_repository_file.this[each.key].repository
  file       = local.resources[each.value].github_repository_file.this[each.key].file
  content    = local.resources[each.value].github_repository_file.this[each.key].content
  # Since 5.25.0 the branch attribute defaults to the default branch of the repository
  # branch              = try(each.value.branch, null)
  branch              = try(local.resources[each.value].github_repository_file.this[each.key].repository, github_repository.this[lower(local.resources[each.value].github_repository_file.this[each.key].repository)].default_branch)
  overwrite_on_create = try(local.resources[each.value].github_repository_file.this[each.key].overwrite_on_create, true)
  # Keep the defaults from 4.x
  commit_author  = try(local.resources[each.value].github_repository_file.this[each.key].commit_author, "GitHub")
  commit_email   = try(local.resources[each.value].github_repository_file.this[each.key].commit_email, "noreply@github.com")
  commit_message = try(local.resources[each.value].github_repository_file.this[each.key].commit_message, "chore: Update ${each.value.file} [skip ci]")

  lifecycle {
    ignore_changes = []
  }
}

resource "github_issue_label" "this" {
  for_each = {
    for item in [
      for repository, config in local.resources.config.github_repository.this : flatten([
        try(config.archived, false) ? [
          for label, config in local.resources.state.github_issue_label.this : {
            source = "state"
            index = label
          } if try(regex("^${repository}:", label), null) != null
        ] : [
          for label, config in local.resources.config.github_issue_label.this : {
            source = "config"
            index = label
          } if try(regex("^${repository}:", label), null) != null
        ]
      ])
    ] : item.index => item.source
  }

  depends_on = [github_repository.this]

  repository  = local.resources[each.value].github_issue_label.this[each.key].repository
  name        = local.resources[each.value].github_issue_label.this[each.key].name

  color       = try(local.resources[each.value].github_issue_label.this[each.key].color, null)
  description = try(local.resources[each.value].github_issue_label.this[each.key].description, null)

  lifecycle {
    ignore_changes = []
  }
}
