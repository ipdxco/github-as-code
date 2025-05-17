resource "github_membership" "this" {
  lifecycle {
    ignore_changes = []
  }
}
resource "github_repository" "this" {
  lifecycle {
    ignore_changes = []
  }
}
resource "github_repository_collaborator" "this" {
  lifecycle {
    ignore_changes = []
  }
}
resource "github_branch_protection" "this" {
  lifecycle {
    ignore_changes = []
  }
}
resource "github_team" "this" {
  lifecycle {
    ignore_changes = []
  }
}
resource "github_team_repository" "this" {
  lifecycle {
    ignore_changes = []
  }
}
resource "github_team_membership" "this" {
  lifecycle {
    ignore_changes = []
  }
}
resource "github_repository_file" "this" {
  lifecycle {
    ignore_changes = []
  }
}
resource "github_issue_labels" "this" {
  lifecycle {
    ignore_changes = []
  }
}
