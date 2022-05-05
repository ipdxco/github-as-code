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
    for repository, files in lookup(local.github, "repository_file", {}) :
    {
      for file, config in {
        for file, config in files :
        file => merge({
          branch = lookup(config, "branch", data.github_repository.this[repository].default_branch)
        }, config) if contains(keys(data.github_repository.this), repository)
      } :
      "${repository}:${config.branch}" => {
        repository = repository
        branch     = config.branch
      }
    }
  ]...)

  branch     = each.value.branch
  repository = each.value.repository
}

# @resources.repository_file.data
data "github_tree" "this" {
  for_each = data.github_branch.this

  recursive  = true
  repository = each.value.repository
  tree_sha   = data.value.sha
}
