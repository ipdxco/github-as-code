resource "github_membership" "this" {
  for_each = merge([
    for role, members in lookup(local.config, "members", {}) : {
      for member in members : lower("${member}") => {
        username = member
        role     = role
      }
    }
  ]...)

  username = each.value.username
  role     = each.value.role

  lifecycle {
    ignore_changes  = []
    prevent_destroy = true
  }
}

resource "github_repository" "this" {
  for_each = {
    for repository, config in lookup(local.config, "repositories", {}) : lower(repository) =>
    try(config.archived, false) ?
    local.state["managed.github_repository.this.${lower(repository)}"] :
    merge(local.defaults.github_repository, merge(config, {
      name = repository
      security_and_analysis = (try(config.visibility, "private") == "public" || local.advanced_security) ? [
        {
          advanced_security               = try(config.visibility, "private") == "public" || !local.advanced_security ? [] : [{ "status" : try(config.advanced_security, false) ? "enabled" : "disabled" }]
          secret_scanning                 = try(config.visibility, "private") != "public" ? [] : [{ "status" : try(config.secret_scanning, false) ? "enabled" : "disabled" }]
          secret_scanning_push_protection = try(config.visibility, "private") != "public" ? [] : [{ "status" : try(config.secret_scanning_push_protection, false) ? "enabled" : "disabled" }]
      }] : []
      pages = try(config.pages, null) == null ? [] : [
        {
          cname = try(config.pages.cname, null)
          source = try(config.pages.source, null) == null ? [] : [
            {
              branch = config.pages.source.branch
              path   = try(config.pages.source.path, null)
            }
          ]
        }
      ]
      template = try([config.template], [])
    }))
  }

  name                                    = each.value.name
  allow_auto_merge                        = each.value.allow_auto_merge
  allow_merge_commit                      = each.value.allow_merge_commit
  allow_rebase_merge                      = each.value.allow_rebase_merge
  allow_squash_merge                      = each.value.allow_squash_merge
  allow_update_branch                     = each.value.allow_update_branch
  archive_on_destroy                      = each.value.archive_on_destroy
  archived                                = each.value.archived
  auto_init                               = each.value.auto_init
  default_branch                          = each.value.default_branch
  delete_branch_on_merge                  = each.value.delete_branch_on_merge
  description                             = each.value.description
  gitignore_template                      = each.value.gitignore_template
  has_discussions                         = each.value.has_discussions
  has_downloads                           = each.value.has_downloads
  has_issues                              = each.value.has_issues
  has_projects                            = each.value.has_projects
  has_wiki                                = each.value.has_wiki
  homepage_url                            = each.value.homepage_url
  ignore_vulnerability_alerts_during_read = each.value.ignore_vulnerability_alerts_during_read
  is_template                             = each.value.is_template
  license_template                        = each.value.license_template
  merge_commit_message                    = each.value.merge_commit_message
  merge_commit_title                      = each.value.merge_commit_title
  squash_merge_commit_message             = each.value.squash_merge_commit_message
  squash_merge_commit_title               = each.value.squash_merge_commit_title
  topics                                  = each.value.topics
  visibility                              = each.value.visibility
  vulnerability_alerts                    = each.value.vulnerability_alerts

  dynamic "security_and_analysis" {
    for_each = each.value.security_and_analysis

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
    for_each = each.value.pages
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
    for_each = each.value.template
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
  for_each = merge(flatten([
    for repository, repository_config in lookup(local.config, "repositories", {}) :
    try(repository_config.archived, false) ?
    [
      {
        for address, resource in local.state : resource.index => resource if try(regex("managed.github_repository_collaborator.this.${lower(repository)}:", address), null) != null
      }
    ] :
    [
      for permission, members in lookup(repository_config, "collaborators", {}) : {
        for member in members : lower("${repository}:${member}") => merge(local.defaults.github_repository_collaborator, {
          repository = repository
          username   = member
          permission = permission
        })
      }
    ]
  ])...)

  depends_on = [github_repository.this]

  repository = each.value.repository
  username   = each.value.username
  permission = each.value.permission

  lifecycle {
    ignore_changes = []
  }
}

resource "github_branch_protection" "this" {
  for_each = merge([
    for repository, repository_config in lookup(local.config, "repositories", {}) :
    try(repository_config.archived, false) ?
    {
      for address, resource in local.state : resource.index => merge(resource, {
        repository_key = null
      }) if try(regex("managed.github_branch_protection.this.${lower(repository)}:", address), null) != null
    } :
    {
      for pattern, config in lookup(repository_config, "branch_protection", {}) : lower("${repository}:${pattern}") => merge(local.defaults.github_branch_protection, merge(config, {
        pattern                       = pattern
        repository_key                = lower(repository)
        required_pull_request_reviews = try([config.required_pull_request_reviews], [])
        required_status_checks        = try([config.required_status_checks], [])
      }))
    }
  ]...)

  pattern                         = each.value.pattern
  repository_id                   = each.value.repository_id != null ? each.value.repository_id : github_repository.this[each.value.repository_key].node_id
  allows_deletions                = each.value.allows_deletions
  allows_force_pushes             = each.value.allows_force_pushes
  blocks_creations                = each.value.blocks_creations
  enforce_admins                  = each.value.enforce_admins
  lock_branch                     = each.value.lock_branch
  push_restrictions               = each.value.push_restrictions
  require_conversation_resolution = each.value.require_conversation_resolution
  require_signed_commits          = each.value.require_signed_commits
  required_linear_history         = each.value.required_linear_history

  dynamic "required_pull_request_reviews" {
    for_each = each.value.required_pull_request_reviews
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
    for_each = each.value.required_status_checks
    content {
      contexts = try(required_status_checks.value["contexts"], null)
      strict   = try(required_status_checks.value["strict"], null)
    }
  }
}

resource "github_team" "this" {
  for_each = {
    for team, config in lookup(local.config, "teams", {}) : lower(team) => merge(local.defaults.github_team, merge(config, {
      name = team
    }))
  }

  name           = each.value.name
  description    = each.value.description
  parent_team_id = try(try(element(data.github_organization_teams.this[0].teams, index(data.github_organization_teams.this[0].teams.*.name, each.value.parent_team_id)).id, each.value.parent_team_id), null)
  privacy        = each.value.privacy

  lifecycle {
    ignore_changes = []
  }
}

resource "github_team_repository" "this" {
  for_each = merge(flatten([
    for repository, repository_config in lookup(local.config, "repositories", {}) :
    try(repository_config.archived, false) ?
    [
      {
        for address, resource in local.state : resource.index => merge(resource, {
          team_key = null
        }) if try(regex("managed.github_team_repository.this.${lower(repository)}:", address), null) != null
      }
    ] :
    [
      for permission, teams in lookup(repository_config, "teams", {}) : {
        for team in teams : lower("${team}:${repository}") => merge(local.defaults.github_team_repository, {
          repository = repository
          team_key   = lower(team)
          permission = permission
        })
      }
    ]
  ])...)

  depends_on = [
    github_repository.this
  ]

  repository = each.value.repository
  team_id    = each.value.team_id != null ? each.value.team_id : github_team.this[each.value.team_key].id

  permission = each.value.permission

  lifecycle {
    ignore_changes = []
  }
}

resource "github_team_membership" "this" {
  for_each = merge(flatten([
    for team, team_config in lookup(local.config, "teams", {}) :
    [
      for role, members in lookup(team_config, "members", {}) : {
        for member in members : lower("${team}:${member}") => merge(local.defaults.github_team_membership, {
          team_key = lower(team)
          username = member
          role     = role
        })
      }
    ]
  ])...)

  team_id  = each.value.team_id != null ? each.value.team_id : github_team.this[each.value.team_key].id
  username = each.value.username
  role     = each.value.role

  lifecycle {
    ignore_changes = []
  }
}

resource "github_repository_file" "this" {
  for_each = merge([
    for repository, repository_config in lookup(local.config, "repositories", {}) :
    try(repository_config.archived, false) ?
    {
      for address, resource in local.state : resource.index => merge(resource, {
        repository_key = null
      }) if try(regex("managed.github_repository_file.this.${lower(repository)}:", address), null) != null
    } :
    {
      for obj in [
        for file, config in lookup(repository_config, "files", {}) : {
          config = merge(local.defaults.github_repository_file, merge(config, {
            repository     = repository
            file           = file
            repository_key = lower(repository)
            content        = try(file("${path.module}/../files/${config.content}"), config.content)
          }))
          state = merge(try(local.state["managed.github_repository_file.this.${lower("${repository}/${file}")}"], {}), {
            repository_key = null
          })
        } if contains(keys(config), "content")
      ] : lower("${obj.config.repository}/${obj.config.file}") => try(obj.state.content, "") == obj.config.content ? obj.state : obj.config
    }
  ]...)

  repository = each.value.repository
  file       = each.value.file
  content    = each.value.content
  # Since 5.25.0 the branch attribute defaults to the default branch of the repository
  # branch              = try(each.value.branch, null)
  branch              = each.value.branch != null ? each.value.branch : github_repository.this[each.value.repository_key].default_branch
  overwrite_on_create = each.value.overwrite_on_create != null ? each.value.overwrite_on_create : true
  # Keep the defaults from 4.x
  commit_author  = each.value.commit_author != null ? each.value.commit_author : "GitHub"
  commit_email   = each.value.commit_email != null ? each.value.commit_email : "noreply@github.com"
  commit_message = each.value.commit_message != null ? each.value.commit_message : "chore: Update ${each.value.file} [skip ci]"

  lifecycle {
    ignore_changes = []
  }
}

resource "github_issue_label" "this" {
  for_each = merge([
    for repository, repository_config in lookup(local.config, "repositories", {}) :
    try(repository_config.archived, false) ?
    {
      for address, resource in local.state : resource.index => resource if try(regex("managed.github_issue_label.this.${lower(repository)}:", address), null) != null
      } : {
      for label, config in lookup(repository_config, "labels", {}) : lower("${repository}:${label}") => merge(local.defaults.github_issue_label, merge(config, {
        repository = repository
        label      = label
      }))
    }
  ]...)

  depends_on = [github_repository.this]

  repository  = each.value.repository
  name        = each.value.label
  color       = each.value.color
  description = each.value.description

  lifecycle {
    ignore_changes = []
  }
}
