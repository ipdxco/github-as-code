data "github_organization" "this" {
  count = length(setintersection(
    toset(["github_membership", "github_repository", "github_branch_protection", "github_repository_collaborator"]),
    toset(local.resource_types)
  )) == 0 ? 0 : 1
  name = local.organization
}

data "github_repositories" "this" {
  count = length(setintersection(
    toset(["github_repository", "github_branch_protection", "github_repository_collaborator"]),
    toset(local.resource_types)
  )) == 0 ? 0 : 1
  query = "org:${local.organization}"
}

data "github_collaborators" "this" {
  for_each = contains(local.resource_types, "github_repository_collaborator") ? toset(data.github_repositories.this[0].names) : []

  owner       = local.organization
  repository  = each.value
  affiliation = "direct"
}

data "github_repository" "this" {
  for_each = length(setintersection(
    toset(["github_branch_protection", "github_repository_file"]),
    toset(local.resource_types)
  )) == 0 ? toset([]) : toset(data.github_repositories.this[0].names)
  name = each.value
}

data "github_organization_teams" "this" {
  count = length(setintersection(
    toset(["github_team", "github_team_repository", "github_team_membership"]),
    toset(local.resource_types)
  )) == 0 ? 0 : 1
}

# once https://github.com/integrations/terraform-provider-github/issues/1131 is resolved
# we can check for file existence in a more targetted, simpler way

data "github_branch" "this" {
  for_each = contains(local.resource_types, "github_repository_file") ? merge([
    for repository, repository_config in lookup(local.config, "repositories", {}) :
    merge([
      for file, config in {
        for file, config in lookup(repository_config, "files", {}) :
        file => merge({
          branch = lookup(config, "branch", data.github_repository.this[repository].default_branch)
        }, config) if contains(keys(data.github_repository.this), repository)
      } :
      {
        "${repository}:${config.branch}" = {
          repository = repository
          branch     = config.branch
        }
      }
    ]...)
  ]...) : {}

  branch     = each.value.branch
  repository = each.value.repository
}

data "github_tree" "this" {
  for_each = data.github_branch.this

  recursive  = true
  repository = each.value.repository
  tree_sha   = each.value.sha
}
