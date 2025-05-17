type ResourceSchema = {
  mode: string
  index: string
  address: string
} & (
  | {
      type: 'github_membership'
      values: {username: string; role: 'admin' | 'member'}
    }
  | {
      type: 'github_branch_protection'
      values: {
        pattern: string
        required_pull_request_reviews?: object[]
        required_status_checks?: object[]
      }
    }
  | {
      type: 'github_repository_collaborator'
      values: {
        permission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull'
        repository: string
        username: string
      }
    }
  | {
      type: 'github_repository_file'
      values: {
        content: string
        file: string
        repository: string
      }
    }
  | {
      type: 'github_issue_labels'
      values: {
        repository: string
        label?: {
          name: string
          color: string
          description: string
        }[]
      }
    }
  | {
      type: 'github_team_repository'
      values: {
        repository: string
        permission: 'admin' | 'maintain' | 'push' | 'triage' | 'pull'
      }
    }
  | {
      type: 'github_repository'
      values: {
        name: string
        pages?: {
          source?: object[]
        }[]
        security_and_analysis?: {
          advanced_security?: {
            status: string
          }[]
          secret_scanning?: {
            status: string
          }[]
          secret_scanning_push_protection?: {
            status: string
          }[]
        }[]
        template?: object[]
      }
    }
  | {
      type: 'github_team_membership'
      values: {
        username: string
        role: 'maintainer' | 'member'
      }
    }
  | {
      type: 'github_team'
      values: {
        name: string
        id: string
        parent_team_id?: string
      }
    }
  | {
      type: 'github_repository_ruleset'
      values: {
        name: string
        rules?: {
          branch_name_pattern?: object[]
          commit_author_email_pattern?: object[]
          commit_message_pattern?: object[]
          committer_email_pattern?: object[]
          merge_queue?: object[]
          pull_request?: object[]
          required_deployments?: object[]
          required_status_checks?: object[]
          tag_name_pattern?: object[]
          required_code_scanning?: object[]
        }[]
        conditions?: {
          ref_name?: object[]
        }[]
      }
    }
  | {
      type: 'github_organization_ruleset'
      values: {
        name: string
        rules?: {
          branch_name_pattern?: object[]
          commit_author_email_pattern?: object[]
          commit_message_pattern?: object[]
          committer_email_pattern?: object[]
          pull_request?: object[]
          required_status_checks?: object[]
          required_workflows?: object[]
          tag_name_pattern?: object[]
          required_code_scanning?: object[]
        }[]
        conditions?: {
          repository_name?: object[]
          ref_name?: object[]
        }[]
      }
    }
)

export type StateSchema = {
  values?: {
    root_module?: {
      resources?: ResourceSchema[]
    }
  }
}
export type Id = string
