output "github_team" {
  value = [
    for team in data.github_organization_teams.this.teams : team.id
  ]
}

output "github_repository" {
  value = data.github_repositories.this.names
}

output "github_team_repository" {
  value = flatten([
    for team in data.github_organization_teams.this.teams :
    [
      for repository in team.repositories : "${team.id}:${repository}"
    ]
  ])
}

output "github_team_membership" {
  value = flatten([
    for team in data.github_organization_teams.this.teams :
    [
      for member in team.members : "${team.id}:${member}"
    ]
  ])
}

output "github_membership" {
  value = [
    for member in data.github_organization.this.members : "${local.organization}:${member}"
  ]
}

output "github_repository_collaborator" {
  value = flatten([
    for repository, collaborators in data.github_collaborators.this :
    [
      for collaborator in collaborators.collaborator : "${repository}:${collaborator.login}"
    ]
  ])
}

output "github_branch_protection" {
  value = flatten([
    for repository, config in data.github_repository.this :
    [
      # unfortunately, we have to assume the branch protection rule is the same as the pattern
      # once the provider migrates to GraphQL API, we'll be able to retrieve true patterns
      # if it is needed before that, we can write our own custom GraphQL query to retrieve patterns
      for branch in config.branches : "${repository}:${branch.name}" if branch.protected
    ]
  ])
}

output "github_repository_file" {
  value = flatten([
    for repository, repository_config in lookup(local.config, "repositories", {}) :
    [
      for file, config in {
        for file, config in lookup(repository_config, "files", {}) :
        file => merge({
          branch = lookup(config, "branch", data.github_repository.this[repository].default_branch)
        }, config) if contains(keys(data.github_repository.this), repository)
      } : "${repository}/${file}:${config.branch}" if contains(keys(data.github_tree.this), "${repository}:${config.branch}") ? contains(data.github_tree.this["${repository}:${config.branch}"].entries.*.path, file) : false
    ]
  ])
}
