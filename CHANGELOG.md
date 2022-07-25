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

### Fixed
- links to supported resources in HOWTOs
- posting PR comments when terraform plan output is very long
