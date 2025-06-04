# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- shared action for adding a collaborator to all repositories
- clean workflow which removes resources from state
- information on how to handle private GitHub Management repository
- warning about GitHub Management repository access
- PR template
- examples to HOWTOs
- repository_file support
- repository.default_branch support
- weekly schedule to the synchronization workflow
- fix workflow which executes user defined config transforms on PRs and after Apply
- shared config fix rule which adds missing default branch protections
- shared action for adding a file to all repositories
- shared action for adding a label to all repositories
- issue_label support
- new args for repositories and branch protection rules

### Changed
- **BREAKING**: added support for efficient labels handling via the `github_issue_labels` resource (please clean `github_issue_label.this.*` from the terraform state and update `locals_override.tf` and `resources_override.tf` before syncing)
- **BREAKING**: upgraded to terraform 1.12.0 and github provider 6.6.0 (please clean `github_branch_protection.this.*` from the terraform state and update `resources_override.tf` before syncing the upgrade)
- **BREAKING**: turned scripts into an ESM project (please ensure you remove the following files during the upgrade: `scripts/.eslintignore`, `scripts/.eslintrc.json`, `scripts/jest.config.js`, `jest.d.ts`, `jest.setup.ts`; please update your imports in the `scripts/src/actions/fix-yaml-config.ts` file to include the `.js` extension)
- **BREAKING**: Updated the signatures of all the shared actions; now the runAction function will persist the changes to disk while action functions will operate on the in-memory state (please update your imports in the `scripts/src/actions/fix-yaml-config.ts` file accordingly)
- Synchronization script: to use GitHub API directly instead of relying on TF GH Provider's Data Sources
- Configuration: replaced multiple JSONs with a single, unified YAML
- Synchronization script: rewrote the script in JS
- Upgrade (reusable) workflow: included docs and CHANGELOG in the upgrades
- README: extracted sections to separate docs
- GitHub Provider: upgraded to v4.23.0
- Upgrade workflows: accept github-mgmt-template ref to upgrade to
- Commit message for repository files: added chore: prefix and [skip ci] suffix
- scripts: to export tf resource definitions and always sort before save
- plan: to be triggered on pull_request_target
- plan: to only check out github directory from the PR
- plan: to wait for Apply workflow runs to finish
- defaults: not to ignore any properties by default
- add-file-to-all-repos: to accept a repo filter instead of an repo exclude list
- sync: to push changes directly to the branch
- automated commit messages: to include github run id information
- apply: not to use deprecated GitHub API anymore
- workflows: not to use deprecated GitHub Actions runners anymore
- workflows: not to use deprecated GitHub Actions expressions anymore
- tf: to prevent destroy of membership and repository resources
- apply: find sha for plan using proper credentials
- updated upload and download artifacts actions to v4

### Fixed
- include labels in the config resources only if they are explicitly defined in the config
- always assert state type when creating resources from state
- do not break long file content lines
- source TF_WORKING_DIR from env helper instead of process.env in locals helper
- fixed how terraform state is accessed before it the initial synchronization
- links to supported resources in HOWTOs
- posting PR comments when terraform plan output is very long
- PR parsing in the update workflow
- array head retrieval in scripts
- team imports
- parent_team_id retrieval from state
- saving config sync result
- how dry run flag is passed in the clean workflow
- how sync invalidates PR plans
- support for pull_request_bypassers in branch protection rules
- how repository files are imported
- how sync handles ignored types
- how indices are represented in the state (always lowercase)
- how sync handles pending invitations (now it does not ignore them)
- removed references to other resources from for_each expressions
- downgraded terraform to 1.2.9 to fix an import bug affecting for_each expressions
