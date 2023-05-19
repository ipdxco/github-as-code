# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
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
- made issue label support more efficient for large orgs

### Fixed
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
