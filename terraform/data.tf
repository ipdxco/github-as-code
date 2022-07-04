data "github_organization" "this" {
  name = local.organization
}

data "github_repositories" "this" {
  query = "org:${local.organization}"
}

data "github_collaborators" "this" {
  for_each = toset(data.github_repositories.this.names)

  owner       = local.organization
  repository  = each.value
  affiliation = "direct"
}

data "github_repository" "this" {
  for_each = toset(data.github_repositories.this.names)
  name     = each.value
}

data "github_organization_teams" "this" {}

# once https://github.com/integrations/terraform-provider-github/issues/1131 is resolved
# we can check for file existence in a more targetted, simpler way

data "github_branch" "this" {
  for_each = merge([
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
  ]...)

  branch     = each.value.branch
  repository = each.value.repository
}

data "github_tree" "this" {
  for_each = data.github_branch.this

  recursive  = true
  repository = each.value.repository
  tree_sha   = each.value.sha
}

resource "null_resource" "data" {
  depends_on = [
    data.github_organization.this,
    data.github_repositories.this,
    data.github_collaborators.this,
    data.github_repository.this,
    data.github_organization_teams.this,
    data.github_branch.this,
    data.github_tree.this
  ]
}
