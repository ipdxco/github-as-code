# Key features

- 2-way sync between GitHub Management and the actual GitHub configuration (including bootstrapping)
- PR-based configuration change review process which guarantees the reviewed plan is the one being applied
- control over what resources and what properties are managed by GitHub Management
- auto-upgrades from the template repository

# How does it work?

GitHub Management allows management of GitHub configuration as code. It uses Terraform and GitHub Actions to achieve this.

The JSON configuration files for a specific organisation are stored in [github/$ORGANIZATION_NAME](github/$ORGANIZATION_NAME) directory. GitHub Management lets you manage multiple organizations from a single repository. It uses separate terraform workspaces per each organisation. The local workspaces are called like the organisations themselves. Each workspace has its state hosted in the remote [S3 backend](https://www.terraform.io/language/settings/backends/s3).

The configuration files are named after the [GitHub Provider resources](https://registry.terraform.io/providers/integrations/github/latest/docs) they configure but are stripped of the `github_` prefix.

Each configuration file contains a single, top-level *JSON* object. The keys in that object are resource identifiers - the required argument values of that resource type. The values - objects describing other arguments, attributes and the id of that resource type.

For example, [github_repository](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository#argument-reference) resource has one required argument - `name` - so the keys inside the object in [repository.json](github/$ORGANIZATION_NAME/repository.json) would be the names of the repositories owned by the organisation. The values in that object would be objects describing remaining [arguments](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository#argument-reference) and [attributes](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository#attributes-reference).

Another example would be [github_branch_protection](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/branch_protection#argument-reference) which has two required arguments - `repository_id` and `pattern`. In such case, the keys would be nested under each other. The keys in the top-level object in [branch_protection.json](github/$ORGANIZATION_NAME/branch_protection.json) would be the IDs of the repositories owned by the organisation and their values would be objects with patterns of branch protection rules for that repository as keys. Where possible, the IDs in key values are replaced with more human friendly values. That's why, the actual top-level key values in [branch_protection.json](github/$ORGANIZATION_NAME/branch_protection.json) would be repository names, not repository IDs.

Whether resources of a specific type are managed via GitHub Management or not is controlled by the existence of the corresponding configuration files. If such a file exists, GitHub Management manages all the arguments and attributes of that resource type except for the ones specified in the `ignore_changes` lists in [terraform/resources_override.tf](terraform/resources_override.tf) or [terraform/resources.tf](terraform/resources.tf).

GitHub Management is capable of both applying the changes made to the JSON configuration files to the actual GitHub configuraiton state and of translating the current GitHub configuration state into the JSON configuration files.

The workflow for introducing changes to GitHub via JSON configuration files is as follows:
1. Modify the JSON configuration file.
1. Create a PR and wait for the GitHub Action workflow triggered on PRs to comment on it with a terraform plan.
1. Review the plan.
1. Merge the PR and wait for the GitHub Action workflow triggered on pushes to the default branch to apply it.

Neither creating the terraform plan nor applying it refreshes the underlying terraform state i.e. going through this workflow does **NOT** ask GitHub if the actual GitHub configuration state has changed. This makes the workflow fast and rate limit friendly because the number of requests to GitHub is minimised. This can result in the plan failing to be applied, e.g. if the underlying resource has been deleted. This assumes that JSON configuration should be the main source of truth for GitHub configuration state. The plans that are created during the PR GitHub Action workflow are applied exactly as-is after the merge.

The workflow for synchronising the current GitHub configuration state with JSON configuration files is as follows:
1. Run the `Sync` GitHub Action workflow and wait for the PR to be created.
1. If a PR was created, wait for the GitHub Action workflow triggered on PRs to comment on it with a terraform plan.
1. Ensure that the plan introduces no changes.
1. Merge the PR.

Running the `Sync` GitHub Action workflows refreshes the underlying terraform state. It also automatically imports all the resources that were created outside GitHub Management into the state and removes any that were deleted. After the `Sync` flow, all the other open PRs should have their GitHub Action workflows rerun because merging them without it would result in the application of their plans to fail due to the plans being created against a different state.

# Supported resources

| Resource | JSON | Key(s) | Dependencies | Description |
| --- | --- | --- | --- | --- |
| [github_membership](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/membership) | `membership.json` | `username` | n/a | add/remove users from your organization |
| [github_repository](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository) | `repository.json` | `repository.name` | n/a | create and manage repositories within your GitHub organization |
| [github_repository_collaborator](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository_collaborator) | `repository_collaborator.json` | `repository.name`: `username` | `github_repository` | add/remove collaborators from repositories in your organization |
| [github_branch_protection](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/branch_protection) | `branch_protection.json` | `repository.name`: `pattern` | `github_repository` | configure branch protection for repositories in your organization |
| [github_team](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team) | `team.json` | `team.name` | n/a | add/remove teams from your organization |
| [github_team_repository](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team_repository) | `team_repository.json` | `team.name`: `repository.name` | `github_team` | manage relationships between teams and repositories in your GitHub organization |
| [github_team_membership](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team_membership) | `team_membership.json` | `team.name`: `username` | `github_team` | add/remove users from teams in your organization |
| [github_repository_file](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository_file) | `repository_file.json` | `repository.name`: `filename` | `github_repository` | add/remove files from repositories in your organization |

## Divergence from Terraform GitHub provider documentation

`github_repository_file.content` accepts either a content string or a path relative to `files` directory.

`github_repository_file.branch` defaults to the default branch of the repository instead of `main`.

# Limitations

Branch protection rules managed via GitHub Management cannot contain wildcards. They also have to match exactly one existing branch. This limitation comes from the fact that there is no GitHub API endpoint which returns a list of branch protection rule patterns for a repository.
