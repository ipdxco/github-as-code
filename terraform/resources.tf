resource "github_membership" "this" {
  for_each = local.resources.github_membership

  username = each.value.username
  role     = each.value.role
  # downgrade_on_destroy = try(each.value.downgrade_on_destroy, null)

  lifecycle {
    ignore_changes  = []
    prevent_destroy = true
  }
}

resource "github_repository" "this" {
  for_each = local.resources.github_repository

  name                                    = each.value.name
  allow_auto_merge                        = try(each.value.allow_auto_merge, null)
  allow_merge_commit                      = try(each.value.allow_merge_commit, null)
  allow_rebase_merge                      = try(each.value.allow_rebase_merge, null)
  allow_squash_merge                      = try(each.value.allow_squash_merge, null)
  allow_update_branch                     = try(each.value.allow_update_branch, null)
  archive_on_destroy                      = try(each.value.archive_on_destroy, null)
  archived                                = try(each.value.archived, null)
  auto_init                               = try(each.value.auto_init, null)
  default_branch                          = try(each.value.default_branch, null)
  delete_branch_on_merge                  = try(each.value.delete_branch_on_merge, null)
  description                             = try(each.value.description, null)
  gitignore_template                      = try(each.value.gitignore_template, null)
  has_discussions                         = try(each.value.has_discussions, null)
  has_downloads                           = try(each.value.has_downloads, null)
  has_issues                              = try(each.value.has_issues, null)
  has_projects                            = try(each.value.has_projects, null)
  has_wiki                                = try(each.value.has_wiki, null)
  homepage_url                            = try(each.value.homepage_url, null)
  ignore_vulnerability_alerts_during_read = try(each.value.ignore_vulnerability_alerts_during_read, null)
  is_template                             = try(each.value.is_template, null)
  license_template                        = try(each.value.license_template, null)
  merge_commit_message                    = try(each.value.merge_commit_message, null)
  merge_commit_title                      = try(each.value.merge_commit_title, null)
  # private                                 = try(each.value.private, null)
  squash_merge_commit_message             = try(each.value.squash_merge_commit_message, null)
  squash_merge_commit_title               = try(each.value.squash_merge_commit_title, null)
  topics                                  = try(each.value.topics, null)
  visibility                              = try(each.value.visibility, null)
  vulnerability_alerts                    = try(each.value.vulnerability_alerts, null)
  web_commit_signoff_required             = try(each.value.web_commit_signoff_required, null)

  dynamic "security_and_analysis" {
    for_each = try(each.value.security_and_analysis, [])

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
    for_each = try(each.value.pages, [])
    content {
      build_type = try(pages.value["build_type"], null)
      cname      = try(pages.value["cname"], null)
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
    for_each = try(each.value.template, [])
    content {
      owner      = template.value["owner"]
      repository = template.value["repository"]
      include_all_branches = try(template.value["include_all_branches"], null)
    }
  }

  lifecycle {
    ignore_changes  = []
    prevent_destroy = true
  }
}

resource "github_repository_collaborator" "this" {
  for_each = local.resources.github_repository_collaborator

  depends_on = [github_repository.this]

  repository                  = each.value.repository
  username                    = each.value.username
  permission                  = each.value.permission
  # permission_diff_suppression = try(each.value.permission_diff_suppression, null)

  lifecycle {
    ignore_changes = []
  }
}

resource "github_branch_protection" "this" {
  for_each = local.resources.github_branch_protection

  pattern = each.value.pattern

  repository_id = lookup(each.value, "repository_id", lookup(lookup(github_repository.this, lower(lookup(each.value, "repository", "")), {}), "node_id", null))

  allows_deletions                = try(each.value.allows_deletions, null)
  allows_force_pushes             = try(each.value.allows_force_pushes, null)
  enforce_admins                  = try(each.value.enforce_admins, null)
  force_push_bypassers            = try(each.value.force_push_bypassers, null)
  lock_branch                     = try(each.value.lock_branch, null)
  require_conversation_resolution = try(each.value.require_conversation_resolution, null)
  require_signed_commits          = try(each.value.require_signed_commits, null)
  required_linear_history         = try(each.value.required_linear_history, null)

  dynamic "required_pull_request_reviews" {
    for_each = try(each.value.required_pull_request_reviews, [])
    content {
      dismiss_stale_reviews           = try(required_pull_request_reviews.value["dismiss_stale_reviews"], null)
      dismissal_restrictions          = try(required_pull_request_reviews.value["dismissal_restrictions"], null)
      pull_request_bypassers          = try(required_pull_request_reviews.value["pull_request_bypassers"], null)
      require_code_owner_reviews      = try(required_pull_request_reviews.value["require_code_owner_reviews"], null)
      require_last_push_approval      = try(required_pull_request_reviews.value["require_last_push_approval"], null)
      required_approving_review_count = try(required_pull_request_reviews.value["required_approving_review_count"], null)
      restrict_dismissals             = try(required_pull_request_reviews.value["restrict_dismissals"], null)
    }
  }
  dynamic "required_status_checks" {
    for_each = try(each.value.required_status_checks, null)
    content {
      contexts = try(required_status_checks.value["contexts"], null)
      strict   = try(required_status_checks.value["strict"], null)
    }
  }
  dynamic "restrict_pushes" {
    for_each = try(each.value.restrict_pushes, [])
    content {
      blocks_creations = try(restrict_pushes.value["blocks_creations"], null)
      push_allowances = try(restrict_pushes.value["push_allowances"], null)
    }
  }
}

resource "github_team" "this" {
  for_each = local.resources.github_team

  name = each.value.name

  parent_team_id = try(try(element(data.github_organization_teams.this[0].teams, index(data.github_organization_teams.this[0].teams.*.name, each.value.parent_team_id)).id, each.value.parent_team_id), null)

  # create_default_maintainer = try(each.value.create_default_maintainer, null)
  description               = try(each.value.description, null)
  # ldap_dn                   = try(each.value.ldap_dn, null)
  privacy                   = try(each.value.privacy, null)

  lifecycle {
    ignore_changes = []
  }
}

resource "github_team_repository" "this" {
  for_each = local.resources.github_team_repository

  depends_on = [github_repository.this]

  repository = each.value.repository
  permission = each.value.permission

  team_id = lookup(each.value, "team_id", lookup(lookup(github_team.this, lower(lookup(each.value, "team", "")), {}), "id", null))

  lifecycle {
    ignore_changes = []
  }
}

resource "github_team_membership" "this" {
  for_each = local.resources.github_team_membership

  username = each.value.username
  role     = each.value.role

  team_id = lookup(each.value, "team_id", lookup(lookup(github_team.this, lower(lookup(each.value, "team", "")), {}), "id", null))

  lifecycle {
    ignore_changes = []
  }
}

resource "github_repository_file" "this" {
  for_each = local.resources.github_repository_file

  repository = each.value.repository
  file       = each.value.file
  content    = each.value.content
  # autocreate_branch = try(each.value.autocreate_branch, null)
  # autocreate_branch_source_branch = try(each.value.autocreate_branch_source_branch, null)
  # autocreate_branch_source_sha = try(each.value.autocreate_branch_source_sha, null)
  # Since 5.25.0 the branch attribute defaults to the default branch of the repository
  # branch              = try(each.value.branch, null)
  branch              = lookup(each.value, "branch", lookup(lookup(github_repository.this, each.value.repository, {}), "default_branch", null))
  overwrite_on_create = try(each.value.overwrite_on_create, true)
  # Keep the defaults from 4.x
  commit_author  = try(each.value.commit_author, "GitHub")
  commit_email   = try(each.value.commit_email, "noreply@github.com")
  commit_message = try(each.value.commit_message, "chore: Update ${each.value.file} [skip ci]")

  lifecycle {
    ignore_changes = []
  }
}

resource "github_issue_label" "this" {
  for_each = local.resources.github_issue_label

  depends_on = [github_repository.this]

  repository = each.value.repository
  name       = each.value.name

  color       = try(each.value.color, null)
  description = try(each.value.description, null)

  lifecycle {
    ignore_changes = []
  }
}
