# GitHub Management via Terraform: Template

This repository is meant to serve as a template for creating new repositories responsible for managing GitHub configuration as code with Terraform. It provides an opinionated way to manage GitHub configuration without following the Terraform usage guidelines to the letter. It was designed with managing multiple, medium to large sized GitHub organisations in mind and that is exactly what it is/is going to be optimised for.

## Key features

- 2-way sync between GitHub Management and the actual GitHub configuration (including bootstrapping)
- PR-based configuration change review process which guarantees the reviewed plan is the one being applied
- control over what resources and what properties are managed by GitHub Management
- auto-upgrades from the template repository

## How does it work?

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

## Supported resources

| Resource | JSON | Key(s) | Dependencies | Description |
| --- | --- | --- | --- | --- |
| [github_membership](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/membership) | `membership.json` | `username` | n/a | add/remove users from your organization |
| [github_repository](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository) | `repository.json` | `repository.name` | n/a | create and manage repositories within your GitHub organization |
| [github_repository_collaborator](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository_collaborator) | `repository_collaborator.json` | `repository.name`: `username` | `github_repository` | add/remove collaborators from repositories in your organization |
| [github_branch_protection](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/branch_protection) | `branch_protection.json` | `repository.name`: `pattern` | `github_repository` | configure branch protection for repositories in your organization |
| [github_team](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team) | `team.json` | `team.name` | n/a | add/remove teams from your organization |
| [github_team_repository](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team_repository) | `team_repository.json` | `team.name`: `repository.name` | `github_team` | manage relationships between teams and repositories in your GitHub organization |
| [github_team_membership](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/team_membership) | `team_membership.json` | `team.name`: `username` | `github_team` | add/remove users from teams in your organization |

### Limitations

Branch protection rules managed via GitHub Management cannot contain wildcards. They also have to match exactly one existing branch. This limitation comes from the fact that there is no GitHub API endpoint which returns a list of branch protection rule patterns for a repository.

## How to...

### ...get started?

*NOTE*: The following TODO list is complete - it contains all the steps you should complete to get GitHub Management up. You might be able to skip some of them if you completed them before.

- [ ] [Create a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) from the template - *this is the place for GitHub Management to live in*

#### AWS

- [ ] [Create a S3 bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/creating-bucket.html) - *this is where Terraform states for the organisations will be stored*
- [ ] [Create a DynamoDB table](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/getting-started-step-1.html) using `LockID` of type `String` as the partition key - *this is where Terraform state locks will be stored*
- [ ] [Create 2 IAM policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create.html) - *they are going to be attached to the users that GitHub Management is going to use to interact with AWS*
    <details><summary>Read-only</summary>

    ```
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Action": [
            "s3:ListBucket"
          ],
          "Effect": "Allow",
          "Resource": "arn:aws:s3:::$S3_BUCKET_NAME"
        },
        {
          "Action": [
            "s3:GetObject"
          ],
          "Effect": "Allow",
          "Resource": "arn:aws:s3:::$S3_BUCKET_NAME/*"
        },
        {
          "Action": [
            "dynamodb:GetItem"
          ],
          "Effect": "Allow",
          "Resource": "arn:aws:dynamodb:*:*:table/$DYNAMO_DB_TABLE_NAME"
        }
      ]
    }
    ```
    </details>
    <details><summary>Read & Write</summary>

    ```
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Action": [
            "s3:ListBucket"
          ],
          "Effect": "Allow",
          "Resource": "arn:aws:s3:::$S3_BUCKET_NAME"
        },
        {
          "Action": [
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject"
          ],
          "Effect": "Allow",
          "Resource": "arn:aws:s3:::$S3_BUCKET_NAME/*"
        },
        {
          "Action": [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:DeleteItem"
          ],
          "Effect": "Allow",
          "Resource": "arn:aws:dynamodb:*:*:table/$DYNAMO_DB_TABLE_NAME"
        }
      ]
    }
    ```
    </details>
- [ ] [Create 2 IAM Users](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html) and save their `AWS_ACCESS_KEY_ID`s and `AWS_SECRET_ACCESS_KEY`s - *they are going to be used by GitHub Management to interact with AWS*
    - [ ] one with read-only policy attached
    - [ ] one with read & write policy attached
- [ ] Modify [terraform/terraform_override.tf](terraform/terraform_override.tf) to reflect your AWS setup

#### GitHub App

*NOTE*: If you already have a GitHub App with required permissions you can skip the app creation step.

- [ ] [Create 2 GitHub Apps](https://docs.github.com/en/developers/apps/building-github-apps/creating-a-github-app) in the GitHub organisation with the following permissions - *they are going to be used by terraform and GitHub Actions to authenticate with GitHub*:
    <details><summary>read-only</summary>

    - `Repository permissions`
        - `Administration`: `Read-only`
        - `Contents`: `Read-only`
        - `Metadata`: `Read-only`
    - `Organization permissions`
        - `Members`: `Read-only`
    </details>
    <details><summary>read & write</summary>

    - `Repository permissions`
        - `Administration`: `Read & Write`
        - `Contents`: `Read & Write`
        - `Metadata`: `Read-only`
        - `Pull requests`: `Read & Write`
        - `Workflows`: `Read & Write`
    - `Organization permissions`
        - `Members`: `Read & Write`
    </details>
- [ ] [Install the GitHub Apps](https://docs.github.com/en/developers/apps/managing-github-apps/installing-github-apps) in the GitHub organisation for `All repositories`

#### GitHub Repository Secrets

- [ ] [Create encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) for the GitHub Management repository (\*replace `$GITHUB_ORGANIZATION_NAME` with the GitHub organisation name) - *these secrets are read by the GitHub Action workflows*
    - [ ] `RO_GITHUB_APP_ID`, `RW_GITHUB_APP_ID`: Go to `https://github.com/organizations/$GITHUB_ORGANIZATION_NAME/settings/apps/$GITHUB_APP_NAME` and copy the `App ID`
    - [ ] `RO_GITHUB_APP_INSTALLATION_ID_$GITHUB_ORGANIZATION_NAME`, `RW_GITHUB_APP_INSTALLATION_ID_$GITHUB_ORGANIZATION_NAME`: Go to `https://github.com/organizations/$GITHUB_ORGANIZATION_NAME/settings/installations`, click `Configure` next to the `$GITHUB_APP_NAME` and copy the numeric suffix from the URL
    - [ ] `RO_GITHUB_APP_PEM_FILE`, `RW_GITHUB_APP_PEM_FILE`: Go to `https://github.com/organizations/$GITHUB_ORGANIZATION_NAME/settings/apps/$GITHUB_APP_NAME`, click `Generate a private key` and copy the contents of the downloaded PEM file
    - [ ] `RO_AWS_ACCESS_KEY_ID`, `RW_AWS_ACCESS_KEY_ID`, `RO_AWS_SECRET_ACCESS_KEY` and `RW_AWS_SECRET_ACCESS_KEY`: Use the values generated during [AWS](#aws) setup

#### GitHub Management Repository Setup

*NOTE*: Advanced users might want to modify the resource types and their arguments/attributes managed by GitHub Management at this stage.

- [ ] [Clone the repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
- [ ] Replace placeholder strings in the clone - *the repository needs to be customised for the specific organisation it is supposed to manage*
    - [ ] Rename the `$GITHUB_ORGANIZATION_NAME` directory in `github` to the name of the GitHub organisation
- [ ] Push the changes to `$GITHUB_MGMT_REPOSITORY_DEFAULT_BRANCH`

#### GitHub Management Sync Flow

- [ ] Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github) to commit the terraform lock and initialize terraform state

#### GitHub Management Repository Protections

*NOTE*: Advanced users might have to skip/adjust this step if they are not managing some of the arguments/attributes mentioned here with GitHub Management.

*NOTE*: If you want to require PRs to be created but don't care about reviews, then change `required_approving_review_count` value to `0`. It seems for some reason the provider's default is `1` instead of `0`. The next `Sync` will remove this value from the configuration file and will leave an empty object inside `required_pull_request_reviews` which is the desired state.

*NOTE*: Branch protection rules are not available for private repositories on Free plan.

- [ ] Manually set  `Settings` > `Actions` > `General` > `Fork pull request workflows from outside collaborators` > `Require approval for all outside collaborators` **AND** `Settings` > `Actions` > `General` > `Workflow permissions` > `Read repository contents permission` because it is impossible to control this value via terraform yet
- [ ] Pull remote changes to the default branch
- [ ] Enable required PRs, peer reviews, status checks and branch up-to-date check on the repository by making sure [github/$ORGANIZATION_NAME/branch_protection.json](github/$ORGANIZATION_NAME/branch_protection.json) contains the following entry:
    ```
    "$GITHUB_MGMT_REPOSITORY_NAME": {
      "$GITHUB_MGMT_REPOSITORY_DEFAULT_BRANCH": {
        "required_pull_request_reviews": [
          {
            "required_approving_review_count": 1
          }
        ],
        "required_status_checks": [
          {
            "contexts": [
              "Plan"
            ],
            "strict": true
          }
        ]
      }
    }
    ```
- [ ] Push the changes to a branch other than the default branch

#### GitHub Management PR Flow

*NOTE*: Advanced users might have to skip this step if they skipped setting up [GitHub Management Repository Protections](#github-management-repository-protections) via GitHub Management.

- [ ] Follow [How to apply GitHub Management changes to GitHub?](#apply-github-management-changes-to-github) to apply protections to the repository

### ...add an organisation to be managed by GitHub Management?

- [ ] Follow [How to get started with GitHub App?](#github-app) to create a GitHub App for the organisation
- [ ] Follow [How to get started with GitHub Organization Secrets?](#github-organisation-secrets) to set up secrets that GitHub Management is going to use
- [ ] Create a new directory called like the organisation under [github](github) directory which is going to store the configuration files
- [ ] Follow [How to add a resource type to be managed by GitHub Management?](#add-a-resource-type-to-be-managed-by-github-management) to add some resources to be managed by GitHub Management
- [ ] Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github) while using the `branch` with your changes as a target to import all the resources you want to manage for the organisation

### ...add a resource type to be managed by GitHub Management?

- [ ] Create a new JSON file with `{}` as content for one of the [supported resources](#supported-resources) under `github/$ORGANIZATION_NAME` directory
- [ ] Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github) while using the `branch` with your changes as a target to import all the resources you want to manage for the organisation

### ...add a resource argument/attribute to be managed by GitHub Management?

*NOTE*: You cannot set the values of attributes via GitHub Management but sometimes it is useful to have them available in the configuration files. For example, it might be a good idea to have `github_team.id` unignored if you want to manage `github_team.parent_team_id` via GitHub Management so that the users can quickly check each team's id without leaving the JSON configuration file.

- [ ] Comment out the argument/attribute you want to start managing using GitHub Management in [terraform/resources.tf](terraform/resources.tf)
- [ ] Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github) while using the `branch` with your changes as a target to import all the resources you want to manage for the organisation

### ...add a resource?

*NOTE*: You do not have to specify all the arguments/attributes when creating a new resource. If you don't, defaults as defined by the [GitHub Provider](https://registry.terraform.io/providers/integrations/github/latest/docs) will be used. The next `Sync` will fill out the remaining arguments/attributes in the JSON configuration file.

*NOTE*: When creating a new resource, you can specify all the arguments that the resource supports even if changes to them are ignored. If you do specify arguments to which changes are ignored, their values are going to be applied during creation but a future `Sync` will remove them from configuration JSON.

- [ ] Add a new JSON object `{}` under unique key in the JSON configuration file for one of the [supported resource](#supported-resources)
- [ ] Follow [How to apply GitHub Management changes to GitHub?](#apply-github-management-changes-to-github) to create your newly added resource

### ...modify a resource?

- [ ] Change the value of an argument/attribute in the JSON configuration file for one of the [supported resource](#supported-resources)
- [ ] Follow [How to apply GitHub Management changes to GitHub?](#apply-github-management-changes-to-github) to create your newly added resource

### ...apply GitHub Management changes to GitHub?

- [ ] [Create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) from the branch to the default branch
- [ ] Merge the pull request once the `Plan` check passes and you verify the plan posted as a comment
- [ ] Confirm that the `Apply` GitHub Action workflow run applied the plan by inspecting the output

### ...synchronize GitHub Management with GitHub?

*NOTE*: Remember that the `Sync` operation modifes terraform state. Even if you run it from a branch, it modifies the global state that is shared with other branches. There is only one terraform state per organisation.

*NOTE*: If you run the `Sync` from an unprotected branch, then the workflow will commit changes to it directly.

*Note*: `Sync` is also going to sort the keys in all the objects lexicographically.

- [ ] Run `Sync` GitHub Action workflow from your desired `branch` - *this will import all the resources from the actual GitHub configuration state into GitHub Management*
- [ ] Merge the pull request that the workflow created once the `Plan` check passes and you verify the plan posted as a comment - *the plan should not contain any changes*

### ...upgrade GitHub Management?

- [ ] Run `Upgrade` GitHub Action workflow
- [ ] Merge the pull request that the workflow created once the `Plan` check passes and you verify the plan posted as a comment - *the plan should not contain any changes*
