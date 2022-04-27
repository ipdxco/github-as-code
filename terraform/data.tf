# @resources.membership.data
data "github_organization" "this" {
  name = local.organization
}

# @resources.repository.data
data "github_repositories" "this" {
  query = "org:${local.organization}"
}

# @resources.repository_collaborator.data
data "github_collaborators" "this" {
  for_each = toset(data.github_repositories.this.names)

  owner       = local.organization
  repository  = each.value
  affiliation = "direct"
}

# @resources.branch_protection.data
data "github_repository" "this" {
  for_each = toset(data.github_repositories.this.names)
  name     = each.value
}

# @resources.team.data
# @resources.team_repository.data
# @resources.team_membership.data
data "github_organization_teams" "this" {}

data "github_branch" "this" {
  for_each = merge([
    for repository, config in data.github_repository.this :
    {
      for branch in config.branches :
      "${repository}:${branch.name}" => {
        repository = repository
        branch     = branch.name
      }
    }
  ]...)

  branch     = each.value.branch
  repository = each.value.repository
}

# @resources.repository_file.data
data "github_tree" "this" {
  for_each = {
    for key, value in data.github_branch.this :
    key => value if contains(keys(lookup(local.github, "repository_file", {})), value.repository) ?
    contains([
      for config in values(lookup(local.github, "repository_file", {})[value.repository]) :
      lookup(config, "branch", data.github_repository.this[value.repository].default_branch)
    ], value.branch) : false
  }

  recursive  = true
  repository = each.value.repository
  tree_sha   = data.github_branch.this["${each.value.repository}:${each.value.branch}"].sha
}
