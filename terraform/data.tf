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
