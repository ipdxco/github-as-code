/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as core from '@actions/core'
import {Octokit} from '@octokit/rest'
import {retry} from '@octokit/plugin-retry'
import {throttling} from '@octokit/plugin-throttling'
import {createAppAuth} from '@octokit/auth-app'
import env from './env'
import {GetResponseDataTypeFromEndpointMethod} from '@octokit/types' // eslint-disable-line import/named

const Client = Octokit.plugin(retry, throttling)
const Endpoints = new Octokit()
type Members = GetResponseDataTypeFromEndpointMethod<
  typeof Endpoints.orgs.getMembershipForUser
>[]
type Repositories = GetResponseDataTypeFromEndpointMethod<
  typeof Endpoints.repos.listForOrg
>
type Teams = GetResponseDataTypeFromEndpointMethod<typeof Endpoints.teams.list>

export class GitHub {
  static github: GitHub
  static async getGitHub(): Promise<GitHub> {
    if (GitHub.github === undefined) {
      const auth = createAppAuth({
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PEM_FILE
      })
      const installationAuth = await auth({
        type: 'installation',
        installationId: env.GITHUB_APP_INSTALLATION_ID
      })
      GitHub.github = new GitHub(installationAuth.token)
    }
    return GitHub.github
  }

  client: InstanceType<typeof Client>

  private constructor(token: string) {
    this.client = new Client({
      auth: token,
      throttle: {
        onRateLimit: (
          retryAfter: number,
          options: {method: string; url: string; request: {retryCount: number}}
        ) => {
          core.warning(
            `Request quota exhausted for request ${options.method} ${options.url}`
          )

          if (options.request.retryCount === 0) {
            // only retries once
            core.info(`Retrying after ${retryAfter} seconds!`)
            return true
          }
        },
        onSecondaryRateLimit: (
          retryAfter: number,
          options: {method: string; url: string; request: {retryCount: number}}
        ) => {
          core.warning(
            `SecondaryRateLimit detected for request ${options.method} ${options.url}`
          )

          if (options.request.retryCount === 0) {
            // only retries once
            core.info(`Retrying after ${retryAfter} seconds!`)
            return true
          }
        }
      }
    })
  }

  private members?: Members
  async listMembers() {
    if (!this.members) {
      core.info('Listing members...')
      const members = await this.client.paginate(this.client.orgs.listMembers, {
        org: env.GITHUB_ORG
      })
      const memberships = await Promise.all(
        members.map(
          async member =>
            await this.client.orgs.getMembershipForUser({
              org: env.GITHUB_ORG,
              username: member.login
            })
        )
      )
      this.members = memberships.map(m => m.data)
    }
    return this.members
  }

  private repositories?: Repositories
  async listRepositories() {
    if (!this.repositories) {
      core.info('Listing repositories...')
      this.repositories = await this.client.paginate(
        this.client.repos.listForOrg,
        {
          org: env.GITHUB_ORG
        }
      )
    }
    return this.repositories
  }

  private teams?: Teams
  async listTeams() {
    if (!this.teams) {
      core.info('Listing teams...')
      this.teams = await this.client.paginate(this.client.teams.list, {
        org: env.GITHUB_ORG
      })
    }
    return this.teams
  }

  async listRepositoryCollaborators() {
    const repositoryCollaborators = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} collaborators...`)
      const collaborators = await this.client.paginate(
        this.client.repos.listCollaborators,
        {owner: env.GITHUB_ORG, repo: repository.name, affiliation: 'direct'}
      )
      repositoryCollaborators.push(
        ...collaborators.map(collaborator => ({repository, collaborator}))
      )
    }
    return repositoryCollaborators
  }

  async listRepositoryBranchProtectionRules() {
    // https://github.com/octokit/graphql.js/issues/61
    const repositoryBranchProtectionRules = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} branch protection rules...`)
      const {
        repository: {
          branchProtectionRules: {nodes}
        }
      }: {repository: {branchProtectionRules: {nodes: {pattern: string}[]}}} =
        await this.client.graphql(
          `
          {
            repository(owner: "${env.GITHUB_ORG}", name: "${repository.name}") {
              branchProtectionRules(first: 100) {
                nodes {
                  pattern
                }
              }
            }
          }
        `
        )
      repositoryBranchProtectionRules.push(
        ...nodes.map(node => ({repository, branchProtectionRule: node}))
      )
    }
    return repositoryBranchProtectionRules
  }

  async listTeamMembers() {
    const teamMembers = []
    const teams = await this.listTeams()
    for (const team of teams) {
      core.info(`Listing ${team.name} members...`)
      const members = await this.client.paginate(
        this.client.teams.listMembersInOrg,
        {org: env.GITHUB_ORG, team_slug: team.slug}
      )
      const memberships = await Promise.all(
        members.map(async member => {
          const membership = (
            await this.client.teams.getMembershipForUserInOrg({
              org: env.GITHUB_ORG,
              team_slug: team.slug,
              username: member.login
            })
          ).data
          return {member, membership}
        })
      )
      teamMembers.push(
        ...memberships.map(({member, membership}) => ({
          team,
          member,
          membership
        }))
      )
    }
    return teamMembers
  }

  async listTeamRepositories() {
    const teamRepositories = []
    const teams = await this.listTeams()
    for (const team of teams) {
      core.info(`Listing ${team.name} repositories...`)
      const repositories = await this.client.paginate(
        this.client.teams.listReposInOrg,
        {org: env.GITHUB_ORG, team_slug: team.slug}
      )
      teamRepositories.push(
        ...repositories.map(repository => ({team, repository}))
      )
    }
    return teamRepositories
  }

  async getRepositoryFile(repository: string, path: string) {
    core.info(`Checking if ${repository}/${path} exists...`)
    try {
      const repo = (
        await this.client.repos.get({
          owner: env.GITHUB_ORG,
          repo: repository
        })
      ).data
      if (repo.owner.login === env.GITHUB_ORG && repo.name === repository) {
        const file = (
          await this.client.repos.getContent({
            owner: env.GITHUB_ORG,
            repo: repository,
            path,
            ref: repo.default_branch
          })
        ).data as {path: string; url: string}
        return {
          ...file,
          ref: repo.default_branch
        }
      } else {
        core.debug(
          `${env.GITHUB_ORG}/${repository} has moved to ${repo.owner.login}/${repo.name}`
        )
        return undefined
      }
    } catch (e) {
      core.debug(JSON.stringify(e))
      return undefined
    }
  }

  async listInvitations() {
    core.info('Listing invitations...')
    const invitations = await this.client.paginate(
      this.client.orgs.listPendingInvitations,
      {
        org: env.GITHUB_ORG
      }
    )
    return invitations.filter(
      i => i.failed_at === null || i.failed_at === undefined
    )
  }

  async listRepositoryInvitations() {
    const repositoryInvitations = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} invitations...`)
      const invitations = await this.client.paginate(
        this.client.repos.listInvitations,
        {
          owner: env.GITHUB_ORG,
          repo: repository.name
        }
      )
      repositoryInvitations.push(
        ...invitations.filter(
          i => i.expired === false || i.expired === undefined
        )
      )
    }
    return repositoryInvitations
  }

  async listTeamInvitations() {
    this.client.orgs.listInvitationTeams
    const teamInvitations = []
    const teams = await this.listTeams()
    for (const team of teams) {
      core.info(`Listing ${team.name} invitations...`)
      const invitations = await this.client.paginate(
        this.client.teams.listPendingInvitationsInOrg,
        {
          org: env.GITHUB_ORG,
          team_slug: team.slug
        }
      )
      teamInvitations.push(
        ...invitations
          .filter(i => i.failed_at === null || i.failed_at === undefined)
          .map(invitation => ({team, invitation}))
      )
    }
    return teamInvitations
  }

  async listRepositoryLabels() {
    const repositoryLabels = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} labels...`)
      const labels = await this.client.paginate(
        this.client.issues.listLabelsForRepo,
        {owner: env.GITHUB_ORG, repo: repository.name}
      )
      repositoryLabels.push(...labels.map(label => ({repository, label})))
    }
    return repositoryLabels
  }
}
