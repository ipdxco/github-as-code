import * as core from '@actions/core'
import {Octokit as Core} from '@octokit/core'
import {Octokit as Client} from '@octokit/rest'
import {retry} from '@octokit/plugin-retry'
import {throttling} from '@octokit/plugin-throttling'
import env from './env.js'
import type {GetResponseDataTypeFromEndpointMethod} from '@octokit/types'
import {Locals} from './terraform/locals.js'

type Endpoints = InstanceType<typeof Client>

type Members = GetResponseDataTypeFromEndpointMethod<
  Endpoints['orgs']['getMembershipForUser']
>[]
type Repositories = GetResponseDataTypeFromEndpointMethod<
  Endpoints['repos']['listForOrg']
>
type Teams = GetResponseDataTypeFromEndpointMethod<Endpoints['teams']['list']>
type RepositoryCollaborators = {
  repository: Repositories[number]
  collaborator: GetResponseDataTypeFromEndpointMethod<
    Endpoints['repos']['listCollaborators']
  >[number]
}[]
type TeamMembers = {
  team: Teams[number]
  member: GetResponseDataTypeFromEndpointMethod<
    Endpoints['teams']['listMembersInOrg']
  >[number]
  membership: GetResponseDataTypeFromEndpointMethod<
    Endpoints['teams']['getMembershipForUserInOrg']
  >
}[]
type TeamRepositories = {
  team: Teams[number]
  repository: Repositories[number]
}[]
type RepositoryBranchProtectionRules = {
  repository: Repositories[number]
  branchProtectionRule: {
    pattern: string
  }
}[]
type RepositoryFile = {
  path: string
  url: string
  ref: string
}
type Invitations = GetResponseDataTypeFromEndpointMethod<
  Endpoints['orgs']['listPendingInvitations']
>
type RepositoryInvitations = GetResponseDataTypeFromEndpointMethod<
  Endpoints['repos']['listInvitations']
>
type TeamInvitations = {
  team: Teams[number]
  invitation: GetResponseDataTypeFromEndpointMethod<
    Endpoints['teams']['listPendingInvitationsInOrg']
  >[number]
}[]
type RepositoryLabels = {
  repository: Repositories[number]
  label: GetResponseDataTypeFromEndpointMethod<
    Endpoints['issues']['listLabelsForRepo']
  >[number]
}[]
type RepositoryActivities = {
  repository: Repositories[number]
  activity: GetResponseDataTypeFromEndpointMethod<
    Endpoints['repos']['listActivities']
  >[number]
}[]
type RepositoryIssues = {
  repository: Repositories[number]
  issue: GetResponseDataTypeFromEndpointMethod<
    Endpoints['issues']['listForRepo']
  >[number]
}[]
type RepositoryPullRequestReviewComments = {
  repository: Repositories[number]
  comment: GetResponseDataTypeFromEndpointMethod<
    Endpoints['pulls']['listReviewCommentsForRepo']
  >[number]
}[]
type RepositoryIssueComments = {
  repository: Repositories[number]
  comment: GetResponseDataTypeFromEndpointMethod<
    Endpoints['issues']['listCommentsForRepo']
  >[number]
}[]
type RepositoryCommitComments = {
  repository: Repositories[number]
  comment: GetResponseDataTypeFromEndpointMethod<
    Endpoints['repos']['listCommitCommentsForRepo']
  >[number]
}[]

export class GitHub {
  static github: GitHub
  static async getGitHub(): Promise<GitHub> {
    if (GitHub.github === undefined) {
      // NOTE: We import these dynamically so that they can be mocked
      const {createAppAuth} = await import('@octokit/auth-app')
      const {Octokit} = await import('@octokit/rest')
      const auth = createAppAuth({
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PEM_FILE
      })
      const installationAuth = await auth({
        type: 'installation',
        installationId: env.GITHUB_APP_INSTALLATION_ID
      })
      const client = new (Octokit.plugin(retry, throttling))({
        auth: installationAuth.token,
        throttle: {
          onRateLimit: (
            retryAfter: number,
            options: {method: string; url: string},
            octokit: Core,
            retryCount: number
          ): boolean => {
            core.warning(
              `Request quota exhausted for request ${options.method} ${options.url}`
            )

            if (retryCount === 0) {
              // only retries once
              core.info(`Retrying after ${retryAfter} seconds!`)
              return true
            }

            return false
          },
          onSecondaryRateLimit: (
            retryAfter: number,
            options: {method: string; url: string},
            octokit: Core,
            retryCount: number
          ): boolean => {
            core.warning(
              `SecondaryRateLimit detected for request ${options.method} ${options.url}`
            )

            if (retryCount === 0) {
              // only retries once
              core.info(`Retrying after ${retryAfter} seconds!`)
              return true
            }

            return false
          }
        }
      })
      GitHub.github = new GitHub(client)
    }
    return GitHub.github
  }

  client: Client

  private constructor(client: Client) {
    this.client = client
  }

  private members?: Members
  async listMembers(): Promise<Members> {
    if (!this.members) {
      core.info('Listing members...')
      const members = await this.client.paginate(this.client.orgs.listMembers, {
        org: env.GITHUB_ORG
      })
      const locals = Locals.getLocals()
      const memberships = await Promise.all(
        members
          .filter(m => !locals.ignore.users.includes(m.login))
          .map(
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
  async listRepositories(): Promise<Repositories> {
    if (!this.repositories) {
      core.info('Listing repositories...')
      const repositories = await this.client.paginate(
        this.client.repos.listForOrg,
        {
          org: env.GITHUB_ORG
        }
      )
      const locals = Locals.getLocals()
      this.repositories = repositories.filter(r => {
        return !locals.ignore.repositories.includes(r.name)
      })
    }
    return this.repositories
  }

  private teams?: Teams
  async listTeams(): Promise<Teams> {
    if (!this.teams) {
      core.info('Listing teams...')
      const teams = await this.client.paginate(this.client.teams.list, {
        org: env.GITHUB_ORG
      })
      const locals = Locals.getLocals()
      this.teams = teams.filter(t => {
        return !locals.ignore.teams.includes(t.name)
      })
    }
    return this.teams
  }

  async listRepositoryCollaborators(): Promise<RepositoryCollaborators> {
    const repositoryCollaborators = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} collaborators...`)
      const collaborators = await this.client.paginate(
        this.client.repos.listCollaborators,
        {owner: env.GITHUB_ORG, repo: repository.name, affiliation: 'direct'}
      )
      const locals = Locals.getLocals()
      repositoryCollaborators.push(
        ...collaborators
          .filter(c => !locals.ignore.users.includes(c.login))
          .map(collaborator => ({repository, collaborator}))
      )
    }
    return repositoryCollaborators
  }

  async listRepositoryBranchProtectionRules(): Promise<RepositoryBranchProtectionRules> {
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

  async listTeamMembers(): Promise<TeamMembers> {
    const teamMembers = []
    const teams = await this.listTeams()
    for (const team of teams) {
      core.info(`Listing ${team.name} members...`)
      const members = await this.client.paginate(
        this.client.teams.listMembersInOrg,
        {org: env.GITHUB_ORG, team_slug: team.slug}
      )
      const locals = Locals.getLocals()
      const memberships = await Promise.all(
        members
          .filter(m => {
            return !locals.ignore.users.includes(m.login)
          })
          .map(async member => {
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

  async listTeamRepositories(): Promise<TeamRepositories> {
    const teamRepositories = []
    const teams = await this.listTeams()
    for (const team of teams) {
      core.info(`Listing ${team.name} repositories...`)
      const repositories = await this.client.paginate(
        this.client.teams.listReposInOrg,
        {org: env.GITHUB_ORG, team_slug: team.slug}
      )
      const locals = Locals.getLocals()
      teamRepositories.push(
        ...repositories
          .filter(r => !locals.ignore.repositories.includes(r.name))
          .map(repository => ({team, repository}))
      )
    }
    return teamRepositories
  }

  async getRepositoryFile(
    repository: string,
    path: string
  ): Promise<RepositoryFile | undefined> {
    core.info(`Checking if ${repository}/${path} exists...`)
    const locals = Locals.getLocals()
    if (locals.ignore.repositories.includes(repository)) {
      return undefined
    }
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

  async listInvitations(): Promise<Invitations> {
    core.info('Listing invitations...')
    const invitations = await this.client.paginate(
      this.client.orgs.listPendingInvitations,
      {
        org: env.GITHUB_ORG
      }
    )
    const locals = Locals.getLocals()
    return invitations
      .filter(i => i.failed_at === null || i.failed_at === undefined)
      .filter(i => i.login === null || !locals.ignore.users.includes(i.login))
  }

  async listRepositoryInvitations(): Promise<RepositoryInvitations> {
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
      const locals = Locals.getLocals()
      repositoryInvitations.push(
        ...invitations
          .filter(i => i.expired === false || i.expired === undefined)
          .filter(
            i =>
              i.invitee === null ||
              !locals.ignore.users.includes(i.invitee.login)
          )
      )
    }
    return repositoryInvitations
  }

  async listTeamInvitations(): Promise<TeamInvitations> {
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
      const locals = Locals.getLocals()
      teamInvitations.push(
        ...invitations
          .filter(i => i.failed_at === null || i.failed_at === undefined)
          .filter(
            i => i.login === null || !locals.ignore.users.includes(i.login)
          )
          .map(invitation => ({team, invitation}))
      )
    }
    return teamInvitations
  }

  async listRepositoryLabels(): Promise<RepositoryLabels> {
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

  async listRepositoryActivities(since: Date): Promise<RepositoryActivities> {
    const repositoryActivities = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} activities...`)
      const activitiesIterator = this.client.paginate.iterator(
        this.client.repos.listActivities,
        {owner: env.GITHUB_ORG, repo: repository.name}
      )
      for await (const {data: activities} of activitiesIterator) {
        let shouldContinue = true
        for (const activity of activities) {
          if (new Date(activity.timestamp) < since) {
            shouldContinue = false
            break
          }
          repositoryActivities.push({repository, activity})
        }
        if (!shouldContinue) {
          break
        }
      }
    }
    return repositoryActivities
  }

  async listRepositoryIssues(since: Date): Promise<RepositoryIssues> {
    const issues = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} issues...`)
      const issuesIterator = this.client.paginate.iterator(
        this.client.issues.listForRepo,
        {
          owner: env.GITHUB_ORG,
          repo: repository.name,
          state: 'all',
          sort: 'created',
          direction: 'desc'
        }
      )
      for await (const {data: issuesData} of issuesIterator) {
        let shouldContinue = true
        for (const issue of issuesData) {
          if (new Date(issue.created_at) < since) {
            shouldContinue = false
            break
          }
          issues.push({repository, issue})
        }
        if (!shouldContinue) {
          break
        }
      }
    }
    return issues
  }

  async listRepositoryPullRequestReviewComments(
    since: Date
  ): Promise<RepositoryPullRequestReviewComments> {
    const pullRequestComments = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} pull request comments...`)
      const pullRequestCommentsIterator = this.client.paginate.iterator(
        this.client.pulls.listReviewCommentsForRepo,
        {owner: env.GITHUB_ORG, repo: repository.name, direction: 'desc'}
      )
      for await (const {data: comments} of pullRequestCommentsIterator) {
        let shouldContinue = true
        for (const comment of comments) {
          if (new Date(comment.created_at) < since) {
            shouldContinue = false
            break
          }
          pullRequestComments.push({repository, comment})
        }
        if (!shouldContinue) {
          break
        }
      }
    }
    return pullRequestComments
  }

  async listRepositoryIssueComments(
    since: Date
  ): Promise<RepositoryIssueComments> {
    const issueComments = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} issue comments...`)
      const issueCommentsIterator = this.client.paginate.iterator(
        this.client.issues.listCommentsForRepo,
        {
          owner: env.GITHUB_ORG,
          repo: repository.name,
          sort: 'created',
          direction: 'desc'
        }
      )
      for await (const {data: comments} of issueCommentsIterator) {
        let shouldContinue = true
        for (const comment of comments) {
          if (new Date(comment.created_at) < since) {
            shouldContinue = false
            break
          }
          issueComments.push({repository, comment})
        }
        if (!shouldContinue) {
          break
        }
      }
    }
    return issueComments
  }

  async listRepositoryCommitComments(
    since: Date
  ): Promise<RepositoryCommitComments> {
    const commitComments = []
    const repositories = await this.listRepositories()
    for (const repository of repositories) {
      core.info(`Listing ${repository.name} commit comments...`)
      const comments = await this.client.paginate(
        this.client.repos.listCommitCommentsForRepo,
        {owner: env.GITHUB_ORG, repo: repository.name}
      )
      for (const comment of comments) {
        if (new Date(comment.created_at) >= since) {
          commitComments.push({repository, comment})
        }
      }
    }
    return commitComments
  }
}
