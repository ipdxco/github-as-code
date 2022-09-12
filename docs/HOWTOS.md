## How to...

### ...create a new resource?

*NOTE*: You do not have to specify all the attributes when creating a new resource. If you don't, defaults as defined by the [GitHub Provider](https://registry.terraform.io/providers/integrations/github/latest/docs) will be used. The next `Sync` will fill out the remaining attributes in the YAML configuration file.

*NOTE*: When creating a new resource, you can specify all the attributes that the resource supports even if changes to them are ignored. If you do specify attributes to which changes are ignored, their values are going to be applied during creation but a future `Sync` will remove them from YAML configuration file.

- Add a new entry to the YAML configuration file - see [EXAMPLE.yml](EXAMPLE.yml) for inspiration
- Follow [How to apply GitHub Management changes to GitHub?](#apply-github-management-changes-to-github) to create your newly added resource

*Example*

I want to invite `galargh` as an admin to `protocol` organization through GitHub Management.

I ensure the YAML configuration file has the following entry:
```yaml
members:
  admin:
    - galargh
```

I push my changes to a new branch and create a PR. An admin reviews the PR and merges it if everything looks OK.

### ...modify an existing resource?

- Change the value of an attribute in the YAML configuration file - see [EXAMPLE.yml](EXAMPLE.yml) for inspiration
- Follow [How to apply GitHub Management changes to GitHub?](#apply-github-management-changes-to-github) to create your newly added resource

*Example*

I want to demote `galargh` from being an `admin` of `protocol` organization to a regular `member` through GitHub Management.

I change the entry for `galargh` in the YAML configuration file from:
```yaml
members:
  admin:
    - galargh
```
to:
```yaml
members:
  member:
    - galargh
```

I push my changes to a new branch and create a PR. An admin reviews the PR and merges it if everything looks OK.

### ...start managing new resource type with GitHub Management?

- Add one of the [supported resources](ABOUT.md#supported-resources) names to the `resource_types` array in [terraform/locals_override.tf](../terraform/locals_override.tf)
- Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github) while using the `branch` with your changes as a target to import all the resources you want to manage for the organization

*Example*

I want to be able to configure who the member of the `protocol` organization is through GitHub Management.

I add `github_membership` to `resource_types` array in [terraform/locals_override.tf](../terraform/locals_override.tf). I push my changes to a new branch and create a PR. An admin reviews the PR, synchronizes my branch with GitHub configuration and merges the PR if everything looks OK.

### ...start managing new resource attribute through GitHub Management?

- If it doesn't exist yet, create an entry for the resource in [terraform/resources_override.tf](../terraform/resources_override.tf) and copy the `lifecycle.ignore_changes` block from the corresponding resource in [terraform/resources.tf](../terraform/resources.tf)
- Comment out the attribute you want to start managing through GitHub Management in [terraform/resources_override.tf](../terraform/resources_override.tf)
- Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github) while using the `branch` with your changes as a target to import all the resources you want to manage for the organization

*Example*

I want to be able to configure the roles of `protocol` organization members through GitHub Management.

I ensure that `terraform/resources_override.tf` contains the following entry (notice the commented out `role` in `ignore_changes` list):
```tf
resource "github_membership" "this" {
  lifecycle {
    # @resources.membership.ignore_changes
    ignore_changes = [
      etag,
      id,
      # role
    ]
  }
}
```

I push my changes to a new branch and create a PR. An admin reviews the PR, synchronizes my branch with GitHub configuration and merges the PR if everything looks OK.

### ...apply GitHub Management changes to GitHub?

- [Create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) from the branch to the default branch
- Merge the pull request once the `Comment` check passes and you verify the plan posted as a comment
- Confirm that the `Apply` GitHub Action workflow run applied the plan by inspecting the output

### ...synchronize GitHub Management with GitHub?

*NOTE*: Remember that the `Sync` operation modifes terraform state. Even if you run it from a branch, it modifies the global state that is shared with other branches. There is only one terraform state per organization.

*NOTE*: If you run the `Sync` from an unprotected branch, then the workflow will commit changes to it directly.

- Run `Sync` GitHub Action workflow from your desired `branch` - *this will import all the resources from the actual GitHub configuration state into GitHub Management*
- Merge the pull request that the workflow created once the `Comment` check passes and you verify the plan posted as a comment - *the plan should not contain any changes*

### ...upgrade GitHub Management?

- Run `Upgrade` GitHub Action workflow
- Merge the pull request that the workflow created once the `Comment` check passes and you verify the plan posted as a comment - *the plan should not contain any changes*

### ...remove resources from GitHub Management state?

- Run `Clean` GitHub Action workflow with a chosen regex
- Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github)

### ...add a new config fix rule?

- Create or modify `scripts/src/actions/fix-yaml-config.ts` file

*Example*

I want to ensure that all the public repositories in my organization have their default branches protected.

To do that, I ensure the following content is present in `scripts/src/actions/fix-yaml-config.ts`:
```ts
import 'reflect-metadata'
import { protectDefaultBranches } from './shared/protect-default-branches'

protectDefaultBranches()
```
