# Key features

- 2-way sync between GitHub Management and the actual GitHub configuration (including bootstrapping)
- PR-based configuration change review process which guarantees the reviewed plan is the one being applied
- control over what resources and what properties are managed by GitHub Management
- auto-upgrades from the template repository

# How does it work?

GitHub Management allows management of GitHub configuration as code. It uses Terraform and GitHub Actions to achieve this.

A GitHub organization is configured through a YAML configuration file - [github/$ORGANIZATION_NAME.yml](../github/$ORGANIZATION_NAME.yml). GitHub Management lets you manage multiple organizations from a single repository. It uses separate terraform workspaces for each organisation. The workspace names are the same as the organization names. Each workspace has its state hosted in the remote [S3 backend](https://www.terraform.io/language/settings/backends/s3).

The configuration files follow [github/.schema.json](../github/.schema.json) schema. You can configure your editor to validate the schema for you, e.g. [a plugin for VS Code](https://github.com/redhat-developer/vscode-yaml).

You can have a look at an [EXAMPLE.yml](./EXAMPLE.yml) which defines all the resources with all the attributes that can be managed through GitHub Management.

Whether resources of a specific type are managed via GitHub Management or not is controlled through [resource_types] array in [terraform/locals_override.tf](../terraform/locals_override.tf). It accepts [supported resource](#supported-resources) names:

Which properties of a resource are managed via GitHub Management is controlled through `lifecycle.ignore_changes` array in [terraform/resources_override.tf](../terraform/resources_override.tf) with a fallback to [terraform/resources.tf](../terraform/resources.tf). By default all but required properties are ignored.

GitHub Management is capable of both applying the changes made to the YAML configuration to GitHub and of translating the current GitHub configuration state back into the YAML configuration file.

The workflow for introducing changes to GitHub via YAML configuration file is as follows:
1. Modify the YAML configuration file.
1. Create a PR and wait for the GitHub Action workflow triggered on PRs to comment on it with a terraform plan.
1. Review the plan.
1. Merge the PR and wait for the GitHub Action workflow triggered on pushes to the default branch to apply it.

Neither creating the terraform plan nor applying it refreshes the underlying terraform state i.e. going through this workflow does **NOT** ask GitHub if the actual GitHub configuration state has changed. This makes the workflow fast and rate limit friendly because the number of requests to GitHub is minimised. This can result in the plan failing to be applied, e.g. if the underlying resource has been deleted. This assumes that YAML configuration is the main source of truth for GitHub configuration state. The plans that are created during the PR GitHub Action workflow are applied exactly as-is after the merge.

The workflow for synchronising the current GitHub configuration state with YAML configuration file is as follows:
1. Run the `Sync` GitHub Action workflow and wait for the PR to be created.
1. If a PR was created, wait for the GitHub Action workflow triggered on PRs to comment on it with a terraform plan.
1. Ensure that the plan introduces no changes.
1. Merge the PR.

Running the `Sync` GitHub Action workflows refreshes the underlying terraform state. It also automatically imports all the resources that were created outside GitHub Management into the state (except for `github_repository_file`s) and removes any that were deleted. After the `Sync` flow, all the other open PRs will have their GitHub Action workflows rerun (thanks to the `Update` workflow) because merging them without it would result in the application of their plans to fail due to the plans being created against a different state.

# Supported Resources

- [github_membership](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/membership)
- [github_repository](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository)
- [github_repository_collaborator](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository_collaborator)
- [github_branch_protection](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/branch_protection)
- [github_team](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team)
- [github_team_repository](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team_repository)
- [github_team_membership](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team_membership)
- [github_repository_file](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository_file)
- [github_issue_labels](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/issue_labels)

# Config Fix Rules

With GitHub Management, you can write config fix rules in TypeScript. Your code will get executed by the `Fix` workflow on each PR (if the repository isn't private) and after each `Apply` workflow run. If your code execution results in any changes to the YAML configuration files, they will be either pushed directly in case of PRs or proposed through PRs otherwise.

Config fix rules have to be put inside `scripts/src/actions/fix-yaml-config.ts` file. Look around `scripts/src` to find useful abstractions for YAML manipulation. You can also browse through a catalog of ready-made rules in `scripts/src/actions/shared`.

You can instruct GitHub Management to skip `Fix` workflow execution on your commit by adding a `[skip fix]` suffix to the first line of your commit message.
