## How to...

### ...add a resource type to be managed by GitHub Management?

- [ ] Create a new JSON file with `{}` as content for one of the [supported resources](#supported-resources) under `github/$ORGANIZATION_NAME` directory
- [ ] Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github) while using the `branch` with your changes as a target to import all the resources you want to manage for the organization

### ...add a resource argument/attribute to be managed by GitHub Management?

*NOTE*: You cannot set the values of attributes via GitHub Management but sometimes it is useful to have them available in the configuration files. For example, it might be a good idea to have `github_team.id` unignored if you want to manage `github_team.parent_team_id` via GitHub Management so that the users can quickly check each team's id without leaving the JSON configuration file.

- [ ] Comment out the argument/attribute you want to start managing using GitHub Management in [terraform/resources.tf](terraform/resources.tf)
- [ ] Follow [How to synchronize GitHub Management with GitHub?](#synchronize-github-management-with-github) while using the `branch` with your changes as a target to import all the resources you want to manage for the organization

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

*NOTE*: Remember that the `Sync` operation modifes terraform state. Even if you run it from a branch, it modifies the global state that is shared with other branches. There is only one terraform state per organization.

*NOTE*: If you run the `Sync` from an unprotected branch, then the workflow will commit changes to it directly.

*Note*: `Sync` is also going to sort the keys in all the objects lexicographically.

- [ ] Run `Sync` GitHub Action workflow from your desired `branch` - *this will import all the resources from the actual GitHub configuration state into GitHub Management*
- [ ] Merge the pull request that the workflow created once the `Plan` check passes and you verify the plan posted as a comment - *the plan should not contain any changes*

### ...upgrade GitHub Management?

- [ ] Run `Upgrade` GitHub Action workflow
- [ ] Merge the pull request that the workflow created once the `Plan` check passes and you verify the plan posted as a comment - *the plan should not contain any changes*
