locals {
  organization   = terraform.workspace
  resource_types = []
  github_pro     = false
  config         = yamldecode(file("${path.module}/../github/${local.organization}.yml"))
  state          = jsondecode(file("${path.module}/${local.organization}.tfstate.json"))
  ignore = {
    "repositories" = []
    "teams"        = []
    "users"        = []
    "rulesets"     = []
  }
  sources = {
    "config" = {
      "github_membership" = {
        "this" = {
          for item in flatten([
            for role, members in lookup(local.config, "members", {}) : [
              for member in members : {
                username = member
                role     = role
              }
            ]
          ]) : lower("${item.username}") => item
        }
      }
      "github_repository" = {
        "this" = {
          for item in [
            for repository, config in lookup(local.config, "repositories", {}) : merge(config, {
              name = repository
              security_and_analysis = (try(config.visibility, "private") == "public" || local.github_pro) ? [
                {
                  advanced_security               = try(config.visibility, "private") == "public" || !local.github_pro ? [] : [{ "status" : try(config.advanced_security, false) ? "enabled" : "disabled" }]
                  secret_scanning                 = try(config.visibility, "private") != "public" ? [] : [{ "status" : try(config.secret_scanning, false) ? "enabled" : "disabled" }]
                  secret_scanning_push_protection = try(config.visibility, "private") != "public" ? [] : [{ "status" : try(config.secret_scanning_push_protection, false) ? "enabled" : "disabled" }]
              }] : []
              pages = try(config.pages, null) != null ? [
                {
                  cname = try(config.pages.cname, null)
                  source = try(config.pages.source, null) == null ? [] : [
                    {
                      branch = config.pages.source.branch
                      path   = try(config.pages.source.path, null)
                    }
                  ]
              }] : []
              template = try([config.template], [])
            })
          ] : lower("${item.name}") => item
        }
      }
      "github_repository_collaborator" = {
        "this" = {
          for item in flatten([
            for repository, config in lookup(local.config, "repositories", {}) : flatten([
              for permission, members in lookup(config, "collaborators", {}) : [
                for member in members : {
                  repository = repository
                  username   = member
                  permission = permission
                }
              ]
            ])
          ]) : lower("${item.repository}:${item.username}") => item
        }
      }
      "github_branch_protection" = {
        "this" = {
          for item in flatten([
            for repository, config in lookup(local.config, "repositories", {}) : [
              for pattern, config in lookup(config, "branch_protection", {}) : merge(config, {
                pattern                       = pattern
                repository                    = repository
                required_pull_request_reviews = try([config.required_pull_request_reviews], [])
                required_status_checks        = try([config.required_status_checks], [])
              })
            ]
          ]) : lower("${item.repository}:${item.pattern}") => item
        }
      }
      "github_team" = {
        "this" = {
          for item in [for team, config in lookup(local.config, "teams", {}) : merge(config, {
            name = team
          })] : lower("${item.name}") => item
        }
      }
      "github_team_repository" = {
        "this" = {
          for item in flatten([
            for repository, config in lookup(local.config, "repositories", {}) : flatten([
              for permission, teams in lookup(config, "teams", {}) : [
                for team in teams : {
                  repository = repository
                  team       = team
                  permission = permission
                }
              ]
            ])
          ]) : lower("${item.team}:${item.repository}") => item
        }
      }
      "github_team_membership" = {
        "this" = {
          for item in flatten([
            for team, config in lookup(local.config, "teams", {}) : flatten([
              for role, members in lookup(config, "members", {}) : [
                for member in members : {
                  team     = team
                  username = member
                  role     = role
                }
              ]
            ])
          ]) : lower("${item.team}:${item.username}") => item
        }
      }
      "github_repository_file" = {
        "this" = {
          for item in flatten([
            for repository, config in lookup(local.config, "repositories", {}) : [
              for file, config in lookup(config, "files", {}) : merge(config, {
                repository = repository
                file       = file
                content    = try(file("${path.module}/../files/${config.content}"), config.content)
              })
            ]
          ]) : lower("${item.repository}/${item.file}") => item
        }
      }
      "github_issue_labels" = {
        "this" = {
          for item in [
            for repository, config in lookup(local.config, "repositories", {}) : {
              repository = repository
              label = [
                for name, config in lookup(config, "labels", {}) : merge(config, {
                  name = name
                })
              ]
            }
          ] : lower("${item.repository}") => item
        }
      }
      "github_repository_ruleset" = {
        "this" = {
          for item in flatten([
            for repository, config in lookup(local.config, "repositories", {}) : [
              for name, config in lookup(config, "rulesets", {}) : merge(config, {
                name       = name
                repository = repository
                rules = try([merge(config.rules, {
                  branch_name_pattern         = try([config.rules.branch_name_pattern], [])
                  commit_author_email_pattern = try([config.rules.commit_author_email_pattern], [])
                  commit_message_pattern      = try([config.rules.commit_message_pattern], [])
                  committer_email_pattern     = try([config.rules.committer_email_pattern], [])
                  merge_queue                 = try([config.rules.merge_queue], [])
                  pull_request                = try([config.rules.pull_request], [])
                  required_deployments        = try([config.rules.required_deployments], [])
                  required_status_checks      = try([config.rules.required_status_checks], [])
                  tag_name_pattern            = try([config.rules.tag_name_pattern], [])
                  required_code_scanning      = try([config.rules.required_code_scanning], [])
                })], [])
                conditions = try([merge(config.conditions, {
                  ref_name = try([config.conditions.ref_name], [])
                })], [])
              })
            ]
          ]) : lower("${item.repository}:${item.name}") => item
        }
      }
      "github_organization_ruleset" = {
        "this" = {
          for item in flatten([
            for repository, config in lookup(local.config, "repositories", {}) : [
              for name, config in lookup(config, "rulesets", {}) : merge(config, {
                name       = name
                repository = repository
                rules = try([merge(config.rules, {
                  branch_name_pattern         = try([config.rules.branch_name_pattern], [])
                  commit_author_email_pattern = try([config.rules.commit_author_email_pattern], [])
                  commit_message_pattern      = try([config.rules.commit_message_pattern], [])
                  committer_email_pattern     = try([config.rules.committer_email_pattern], [])
                  pull_request                = try([config.rules.pull_request], [])
                  required_status_checks      = try([config.rules.required_status_checks], [])
                  required_workflows          = try([config.rules.required_workflows], [])
                  tag_name_pattern            = try([config.rules.tag_name_pattern], [])
                  required_code_scanning      = try([config.rules.required_code_scanning], [])
                })], [])
                conditions = try([merge(config.conditions, {
                  repository_name = try([config.conditions.ref_name], [])
                  ref_name        = try([config.conditions.ref_name], [])
                })], [])
              })
            ]
          ]) : lower("${item.repository}:${item.name}") => item
        }
      }
    }
    "state" = lookup({
      for mode, item in {
        for item in try(local.state.values.root_module.resources, []) : item.mode => item...
        } : mode => {
        for type, item in {
          for item in item : item.type => item...
          } : type => {
          for name, item in {
            for item in item : item.name => item...
            } : name => {
            for index, item in {
              for item in item : item.index => item.values
            } : index => item
          }
        }
      }
    }, "managed", {})
  }
  resources = {
    "github_membership" = {
      for item in [
        for member, config in local.sources.config.github_membership.this : {
          source = "config"
          index  = member
        }
      ] : item.index => local.sources[item.source].github_membership.this[item.index]
    }
    "github_repository" = {
      for item in [
        for repository, config in local.sources.config.github_repository.this :
        try(config.archived, false) ? {
          source   = "state"
          index    = repository
          archived = config.archived
          } : {
          source   = "config"
          index    = repository
          archived = try(config.archived, false)
        }
      ] : item.index => merge(local.sources[item.source].github_repository.this[item.index], { archived = item.archived })
    }
    "github_repository_collaborator" = {
      for item in flatten([
        for repository, config in local.sources.config.github_repository.this : flatten([
          try(config.archived, false) ? [
            for member, config in try(local.sources.state.github_repository_collaborator.this, {}) : {
              source = "state"
              index  = member
            } if lower(config.repository) == repository
            ] : [
            for member, config in local.sources.config.github_repository_collaborator.this : {
              source = "config"
              index  = member
            } if lower(config.repository) == repository
          ]
        ])
      ]) : item.index => local.sources[item.source].github_repository_collaborator.this[item.index]
    }
    "github_branch_protection" = {
      for item in flatten([
        for repository, config in local.sources.config.github_repository.this : flatten([
          try(config.archived, false) ? [
            for branch_protection, config in try(local.sources.state.github_branch_protection.this, {}) : {
              source = "state"
              index  = branch_protection
            } if split(":", branch_protection)[0] == repository
            ] : [
            for branch_protection, config in local.sources.config.github_branch_protection.this : {
              source = "config"
              index  = branch_protection
            } if lower(config.repository) == repository
          ]
        ])
      ]) : item.index => local.sources[item.source].github_branch_protection.this[item.index]
    }
    "github_team" = {
      for item in [
        for team, config in local.sources.config.github_team.this : {
          source = "config"
          index  = team
        }
      ] : item.index => local.sources[item.source].github_team.this[item.index]
    }
    "github_team_repository" = {
      for item in flatten([
        for repository, config in local.sources.config.github_repository.this : flatten([
          try(config.archived, false) ? [
            for team, config in try(local.sources.state.github_team_repository.this, {}) : {
              source = "state"
              index  = team
            } if lower(config.repository) == repository
            ] : [
            for team, config in local.sources.config.github_team_repository.this : {
              source = "config"
              index  = team
            } if lower(config.repository) == repository
          ]
        ])
      ]) : item.index => local.sources[item.source].github_team_repository.this[item.index]
    }
    "github_team_membership" = {
      for item in [
        for member, config in local.sources.config.github_team_membership.this : {
          source = "config"
          index  = member
        }
      ] : item.index => local.sources[item.source].github_team_membership.this[item.index]
    }
    "github_repository_file" = {
      for item in flatten([
        for repository, config in local.sources.config.github_repository.this : flatten([
          try(config.archived, false) ? [
            for file, config in try(local.sources.state.github_repository_file.this, {}) : {
              source = "state"
              index  = file
            } if lower(config.repository) == repository
            ] : [
            for file, config in local.sources.config.github_repository_file.this : {
              source = try(local.sources.state.github_repository_file.this[file].content, "") == try(config.content, "") ? "state" : "config"
              index  = file
            } if lower(config.repository) == repository
          ]
        ])
      ]) : item.index => local.sources[item.source].github_repository_file.this[item.index]
    }
    "github_issue_labels" = {
      for item in flatten([
        for repository, config in local.sources.config.github_repository.this : flatten([
          try(config.archived, false) ? [
            for labelsRepository, config in try(local.sources.state.github_issue_labels.this, {}) : {
              source = "state"
              index  = labelsRepository
            } if lower(config.repository) == repository
            ] : [
            for labelsRepository, config in local.sources.config.github_issue_labels.this : {
              source = "config"
              index  = labelsRepository
            } if lower(config.repository) == repository
          ]
        ])
      ]) : item.index => local.sources[item.source].github_issue_labels.this[item.index]
    }
    "github_repository_ruleset" = {
      for item in flatten([
        for repository, config in local.sources.config.github_repository.this : flatten([
          try(config.archived, false) ? [
            for ruleset, config in try(local.sources.state.github_repository_ruleset.this, {}) : {
              source = "state"
              index  = ruleset
            } if split(":", ruleset)[0] == repository
            ] : [
            for ruleset, config in local.sources.config.github_repository_ruleset.this : {
              source = "config"
              index  = ruleset
            } if lower(config.repository) == repository
          ]
        ])
      ]) : item.index => local.sources[item.source].github_repository_ruleset.this[item.index]
    }
    "github_organization_ruleset" = {
      for item in [
        for name, config in local.sources.config.github_organization_ruleset.this : {
          source = "config"
          index  = name
        }
      ] : item.index => local.sources[item.source].github_organization_ruleset.this[item.index]
    }
  }
}
