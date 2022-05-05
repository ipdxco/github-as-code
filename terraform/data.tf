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

# once https://github.com/integrations/terraform-provider-github/issues/1131 is resolved
# we can replace data.github_branch.this and data.github_tree.this with the following:
# data "github_repository_file" "this" {
#   for_each = merge([
#     for repository, files in lookup(local.github, "repository_file", {}) :
#     {
#       for file, config in {
#         for file, config in files :
#         file => merge({
#           branch = lookup(config, "branch", data.github_repository.this[repository].default_branch)
#         }, config) if contains(keys(data.github_repository.this), repository)
#       } :
#       "${repository}/${file}:${config.branch}" => {
#         repository = repository
#         file       = file
#         branch     = config.branch
#       }
#     }
#   ]...)
#
#   repository = each.value.repository
#   file       = each.value.file
#   branch     = each.value.branch
# }

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
  tree_sha   = each.value.sha
}
