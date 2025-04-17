locals {
  resource_types = [
    "github_membership",
    "github_repository_collaborator",
    "github_repository",
    "github_team_membership",
    "github_team_repository",
    "github_team",
    "github_branch_protection",
    "github_repository_file",
    "github_issue_label"
  ]
  ignore = {
    "repositories" = ["ignored"]
    "teams" = ["ignored"]
    "users" = ["ignored"]
  }
}
