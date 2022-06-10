resource "github_branch_protection" "this" {
  lifecycle {
    ignore_changes = [
      allows_deletions,
      allows_force_pushes,
      enforce_admins,
      id,
      push_restrictions,
      require_conversation_resolution,
      require_signed_commits,
      required_linear_history,
      # required_pull_request_reviews,
      required_pull_request_reviews[0].dismiss_stale_reviews,
      required_pull_request_reviews[0].dismissal_restrictions,
      required_pull_request_reviews[0].require_code_owner_reviews,
      required_pull_request_reviews[0].required_approving_review_count,
      required_pull_request_reviews[0].restrict_dismissals,
      # required_status_checks,
      # required_status_checks[0].contexts,
      # required_status_checks[0].strict
    ]
  }
}
