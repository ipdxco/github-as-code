# Setup

*NOTE*: The following TODO list is complete - it contains all the steps you should complete to get GitHub Management up. You might be able to skip some of them if you completed them before.

- [ ] [Create a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) from the template - *this is the place for GitHub Management to live in*

## GitHub Organization

- [ ] [Set base permissions for the organization](https://docs.github.com/en/organizations/managing-access-to-your-organizations-repositories/setting-base-permissions-for-an-organization) to `Read` or `None` not to make all organization members de-facto admins through GitHub Management - `gh -X PATCH /orgs/$GITHUB_ORGANIZATION -f default_repository_permission=read`
- [ ] If you plan to keep the GitHub Management repository private, [allow forking of private repositories](https://docs.github.com/en/organizations/managing-organization-settings/managing-the-forking-policy-for-your-organization) and [enable workflows for private repository forks](https://docs.github.com/en/organizations/managing-organization-settings/disabling-or-limiting-github-actions-for-your-organization#enabling-workflows-for-private-repository-forks) - `gh -X PATCH /orgs/$GITHUB_ORGANIZATION -f members_can_fork_private_repositories=true` (enabling workflows for private repository forks is not possible through API)

## AWS

*NOTE*: Setting up AWS can be automated with [terraform](../terraform/bootstrap/aws.tf). If you choose to create AWS with terraform, remember that you'll still need to retrieve `AWS_ACCESS_KEY_ID`s and `AWS_SECRET_ACCESS_KEY`s manually.

- [ ] [Create a S3 bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/creating-bucket.html) - *this is where Terraform states for the organizations will be stored*
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

## GitHub App

*NOTE*: If you already have a GitHub App with required permissions you can skip the app creation step.

- [ ] [Create 2 GitHub Apps](https://docs.github.com/en/developers/apps/building-github-apps/creating-a-github-app) in the GitHub organization with the following permissions - *they are going to be used by terraform and GitHub Actions to authenticate with GitHub*:
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
- [ ] [Install the GitHub Apps](https://docs.github.com/en/developers/apps/managing-github-apps/installing-github-apps) in the GitHub organization for `All repositories`

## GitHub Repository Secrets

- [ ] [Create encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-an-organization) for the GitHub organization and allow the repository to access them (\*replace `$GITHUB_ORGANIZATION_NAME` with the GitHub organization name) - *these secrets are read by the GitHub Action workflows*
    - [ ] Go to `https://github.com/organizations/$GITHUB_ORGANIZATION_NAME/settings/apps/$GITHUB_APP_NAME` and copy the `App ID`
       - [ ] `RO_GITHUB_APP_ID`
       - [ ] `RW_GITHUB_APP_ID`
    - [ ] Go to `https://github.com/organizations/$GITHUB_ORGANIZATION_NAME/settings/installations`, click `Configure` next to the `$GITHUB_APP_NAME` and copy the numeric suffix from the URL
       - [ ] `RO_GITHUB_APP_INSTALLATION_ID` (or `RO_GITHUB_APP_INSTALLATION_ID_$GITHUB_ORGANIZATION_NAME` for organizations other than the repository owner)
       - [ ] `RW_GITHUB_APP_INSTALLATION_ID` (or `RW_GITHUB_APP_INSTALLATION_ID_$GITHUB_ORGANIZATION_NAME` for organizations other than the repository owner)
    - [ ] Go to `https://github.com/organizations/$GITHUB_ORGANIZATION_NAME/settings/apps/$GITHUB_APP_NAME`, click `Generate a private key` and copy the contents of the downloaded PEM file
       - [ ] `RO_GITHUB_APP_PEM_FILE`
       - [ ] `RW_GITHUB_APP_PEM_FILE`
    - [ ] Use the values generated during [AWS](#aws) setup
       - [ ] `RO_AWS_ACCESS_KEY_ID`
       - [ ] `RW_AWS_ACCESS_KEY_ID`
       - [ ] `RO_AWS_SECRET_ACCESS_KEY`
       - [ ] `RW_AWS_SECRET_ACCESS_KEY`

## GitHub Management Repository Setup

*NOTE*: Advanced users might want to modify the resource types and their arguments/attributes managed by GitHub Management at this stage.

*NOTE*: You can manage more than one organization from a single GitHub Management repository. To do so create more subdirectories under `github` directory. Remember to set up secrets for all your organizations.

- [ ] [Clone the repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
- [ ] Replace placeholder strings in the clone - *the repository needs to be customised for the specific organization it is supposed to manage*
    - [ ] Rename the `$GITHUB_ORGANIZATION_NAME` directory in `github` to the name of the GitHub organization
- [ ] Push the changes to `$GITHUB_MGMT_REPOSITORY_DEFAULT_BRANCH`

## GitHub Management Sync Flow

- [ ] Follow [How to synchronize GitHub Management with GitHub?](HOWTOS.md#synchronize-github-management-with-github) to commit the terraform lock and initialize terraform state

## GitHub Management Repository Protections

*NOTE*: Advanced users might have to skip/adjust this step if they are not managing some of the arguments/attributes mentioned here with GitHub Management.

*NOTE*: If you want to require PRs to be created but don't care about reviews, then change `required_approving_review_count` value to `0`. It seems for some reason the provider's default is `1` instead of `0`. The next `Sync` will remove this value from the configuration file and will leave an empty object inside `required_pull_request_reviews` which is the desired state.

*NOTE*: Branch protection rules are not available for private repositories on Free plan.

- [ ] Manually set values that are impossible to control this value via terraform currently
   - [ ] [Set read repository contents permissions for `GITHUB_TOKEN`](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#setting-the-permissions-of-the-github_token-for-your-repository)
   - [ ] If the repository is public, [require approval for all outside collaborators](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#configuring-required-approval-for-workflows-from-public-forks)
   - [ ] If the repository is private, [disable sending write tokens or secrets to worfklows from fork pull requests](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#enabling-workflows-for-private-repository-forks)
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

## GitHub Management PR Flow

*NOTE*: Advanced users might have to skip this step if they skipped setting up [GitHub Management Repository Protections](#github-management-repository-protections) via GitHub Management.

- [ ] Follow [How to apply GitHub Management changes to GitHub?](HOWTOS.md#apply-github-management-changes-to-github) to apply protections to the repository
