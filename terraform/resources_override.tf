resource "github_repository" "this" {
  lifecycle {
    # @resources.repository.ignore_changes
    ignore_changes = [
      allow_auto_merge,
      # allow_merge_commit,
      # allow_rebase_merge,
      # allow_squash_merge,
      archive_on_destroy,
      archived,
      auto_init,
      branches,
      default_branch,
      delete_branch_on_merge,
      description,
      etag,
      full_name,
      git_clone_url,
      gitignore_template,
      has_downloads,
      has_issues,
      has_projects,
      has_wiki,
      homepage_url,
      html_url,
      http_clone_url,
      id,
      is_template,
      license_template,
      node_id,
      pages,
      pages[0].cname,
      pages[0].source[0].path,
      private,
      repo_id,
      ssh_clone_url,
      svn_url,
      template,
      topics,
      visibility,
      vulnerability_alerts
    ]
  }
}

resource "github_branch_protection" "this" {
  lifecycle {
    # @resources.branch_protection.ignore_changes
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
