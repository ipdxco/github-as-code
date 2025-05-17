variable "write_delay_ms" {
  description = "Amount of time in milliseconds to sleep in between writes to GitHub API."
  type        = number
  default     = 1000
}

variable "resources" {
  description = "Resources to import."
  type = object({
    github_membership              = optional(map(any), {})
    github_repository              = optional(map(any), {})
    github_repository_collaborator = optional(map(any), {})
    github_branch_protection       = optional(map(any), {})
    github_team                    = optional(map(any), {})
    github_team_repository         = optional(map(any), {})
    github_team_membership         = optional(map(any), {})
    github_repository_file         = optional(map(any), {})
    github_issue_labels            = optional(map(any), {})
  })
  default = null
}
