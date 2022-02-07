output "team" {
  value = [
    for team in data.github_organization_teams.this.teams :
    {
      id = team.id
      index = team.name
    }
  ]
}

output "repository" {
  value = [
    for name in data.github_repositories.this.names :
    {
      id = name
      index = name
    }
  ]
}

output "team_repository" {
  value = flatten([
    for team in data.github_organization_teams.this.teams :
    [
      for repository in team.repositories :
      {
        id = "${team.id}:${repository}"
        index = "${team.name}${local.separator}${repository}"
      }
    ]
  ])
}

output "team_membership" {
  value = flatten([
    for team in data.github_organization_teams.this.teams :
    [
      for member in team.members :
      {
        id = "${team.id}:${member}"
        index = "${team.name}${local.separator}${member}"
      }
    ]
  ])
}

output "membership" {
  value = [
    for member in data.github_organization.this.members :
    {
      id = "${local.organization}:${member}"
      index = member
    }
  ]
}

output "repository_collaborator" {
  value = flatten([
    for repository, collaborators in data.github_collaborators.this :
    [
      for collaborator in collaborators.collaborator :
      {
        id = "${repository}:${collaborator.login}"
        index = "${repository}${local.separator}${collaborator.login}"
      }
    ]
  ])
}

output "branch_protection" {
  value = flatten([
    for repository, config in data.github_repository.this :
    [
      # unfortunately, we have to assume the branch protection rule is the same as the pattern
      # once the provider migrates to GraphQL API, we'll be able to retrieve true patterns
      # if it is needed before that, we can write our own custom GraphQL query to retrieve patterns
      for branch in config.branches :
      {
        id = "${repository}:${branch.name}"
        index = "${repository}${local.separator}${branch.name}"
      } if branch.protected
    ]
  ])
}
