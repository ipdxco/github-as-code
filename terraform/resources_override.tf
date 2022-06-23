resource "github_branch_protection" "this" {
  lifecycle {
    ignore_changes = [
      allows_deletions,
      allows_force_pushes,
      enforce_admins,
      push_restrictions,
      require_conversation_resolution,
      require_signed_commits,
      required_linear_history,
      # required_pull_request_reviews,
      # required_status_checks
    ]
  }
}
