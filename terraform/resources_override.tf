resource "github_repository" "this" {
  lifecycle {
    ignore_changes = [
      allow_auto_merge,
      allow_merge_commit,
      allow_rebase_merge,
      allow_squash_merge,
      archive_on_destroy,
      archived,
      auto_init,
      default_branch,
      delete_branch_on_merge,
      description,
      gitignore_template,
      has_downloads,
      has_issues,
      has_projects,
      has_wiki,
      homepage_url,
      ignore_vulnerability_alerts_during_read,
      is_template,
      license_template,
      pages,
      template,
      topics,
      visibility,
      vulnerability_alerts,
      web_commit_signoff_required,
    ]
  }
}

resource "github_branch_protection" "this" {
  lifecycle {
    ignore_changes = [
      allows_deletions,
      allows_force_pushes,
      enforce_admins,
      force_push_bypassers,
      require_conversation_resolution,
      require_signed_commits,
      required_linear_history,
      # required_pull_request_reviews,
      # required_status_checks,
      restrict_pushes,
    ]
  }
}

resource "github_team" "this" {
  lifecycle {
    ignore_changes = [
      description,
      parent_team_id,
      privacy,
    ]
  }
}

resource "github_repository_file" "this" {
  lifecycle {
    ignore_changes = [
      overwrite_on_create,
    ]
  }
}

resource "github_repository_ruleset" "this" {
  lifecycle {
    ignore_changes = [
      target,
      enforcement,
      rules.creation,
      rules.deletion,
      rules.non_fast_forward,
      rules.required_linear_history,
      rules.required_signatures,
      rules.update,
      rules.update_allows_fetch_and_merge,
      rules.branch_name_pattern,
      rules.commit_author_email_pattern,
      rules.commit_message_pattern,
      rules.committer_email_pattern,
      rules.merge_queue,
      rules.pull_request,
      rules.required_deployments,
      rules.required_status_checks,
      rules.tag_name_pattern,
      rules.required_code_scanning,
      bypass_actors,
      conditions,
    ]
  }
}

resource "github_organization_ruleset" "this" {
  lifecycle {
    ignore_changes = [
      target,
      enforcement,
      rules.creation,
      rules.deletion,
      rules.non_fast_forward,
      rules.required_linear_history,
      rules.required_signatures,
      rules.update,
      rules.branch_name_pattern,
      rules.commit_author_email_pattern,
      rules.commit_message_pattern,
      rules.committer_email_pattern,
      rules.pull_request,
      rules.required_status_checks,
      rules.required_workflows,
      rules.tag_name_pattern,
      rules.required_code_scanning,
      bypass_actors,
      conditions,
    ]
  }
}
