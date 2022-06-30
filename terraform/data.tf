data "github_organization" "data_github_organization" {
  name = local.organization
}

data "github_repositories" "data_github_repositories" {
  query = "org:${local.organization}"
}

data "github_collaborators" "data_github_collaborators" {
  for_each = toset(data.github_repositories.repository_names_data.names)

  owner       = local.organization
  repository  = each.value
  affiliation = "direct"
}

data "github_repository" "data_github_repository" {
  for_each = toset(data.github_repositories.repository_names_data.names)
  name     = each.value
}

data "github_organization_teams" "data_github_organization_teams" {}

# once https://github.com/integrations/terraform-provider-github/issues/1131 is resolved
# we can check for file existence in a more targetted, simpler way

data "github_branch" "data_github_branch" {
  for_each = merge([
    for repository, repository_config in lookup(local.config, "repositories", {}) :
    merge([
      for file, config in {
        for file, config in lookup(repository_config, "files", {}) :
        file => merge({
          branch = lookup(config, "branch", data.github_repository.repositories_data[repository].default_branch)
        }, config) if contains(keys(data.github_repository.repositories_data), repository)
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

data "github_tree" "data_github_tree" {
  for_each = data.github_branch.repository_branches_data

  recursive  = true
  repository = each.value.repository
  tree_sha   = each.value.sha
}

resource "null_resource" "data" {
  depends_on = [
    data.github_organization.organization_data,
    data.github_repositories.repository_names_data,
    data.github_collaborators.repository_collaborators_data,
    data.github_repository.repositories_data,
    data.github_organization_teams.teams_data,
    data.github_branch.repository_branches_data,
    data.github_tree.repository_files_data
  ]
}
