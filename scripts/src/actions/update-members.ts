import 'reflect-metadata'
import * as core from '@actions/core'
import {pathToFileURL} from 'url'
import {Config} from '../yaml/config.js'
import {Member} from '../resources/member.js'
import {Repository, Visibility} from '../resources/repository.js'
import {
  Permission as RepositoryCollaboratorPermission,
  RepositoryCollaborator
} from '../resources/repository-collaborator.js'
import {TeamMember} from '../resources/team-member.js'
import {GitHub} from '../github.js'
import {
  betterPermission,
  getAccessSummaryFrom,
  hasKeepComment,
  parseUserList
} from './shared/access-summary.js'

export type PublicRepoAccess = 'retain' | 'remove'
export type OrganizationMembership = 'keep' | 'remove'

export type MemberActivity = {
  username: string
  latestActivity?: Date
}

export type UpdateMembersOptions = {
  cutoffDate?: Date
  limit?: number
  ignore: string[]
  only: string[]
  publicRepoAccess: PublicRepoAccess
  organizationMembership: OrganizationMembership
}

type ActivityRecord = {
  username: string
  createdAt: Date
}

export function parseCutoffDate(source?: string): Date | undefined {
  if (source === undefined || source.trim() === '') {
    return undefined
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    throw new Error('cutoff-date must use YYYY-MM-DD format')
  }
  const date = new Date(`${source}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf())) {
    throw new Error('cutoff-date must be a valid date')
  }
  return date
}

export function parseLimit(source?: string): number | undefined {
  if (source === undefined || source.trim() === '') {
    return undefined
  }
  const limit = Number(source)
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer')
  }
  return limit
}

export function parsePublicRepoAccess(source?: string): PublicRepoAccess {
  if (source === 'retain' || source === 'remove') {
    return source
  }
  throw new Error('public-repo-access must be retain or remove')
}

export function parseOrganizationMembership(
  source?: string
): OrganizationMembership {
  if (source === 'keep' || source === 'remove') {
    return source
  }
  throw new Error('organization-membership must be keep or remove')
}

export function selectMembersForUpdate(
  config: Config,
  activities: MemberActivity[],
  options: UpdateMembersOptions
): string[] {
  if (options.cutoffDate === undefined && options.only.length === 0) {
    throw new Error('Either cutoff-date or only must be provided')
  }

  const activityByUsername = new Map(
    activities.map(activity => [activity.username.toLowerCase(), activity])
  )
  const ignore = new Set(options.ignore)
  const only = new Set(options.only)

  const candidates = config
    .getResources(Member)
    .filter(member => !hasKeepComment(config, member))
    .map(member => member.username.toLowerCase())
    .filter(username => !ignore.has(username))
    .filter(username => only.size === 0 || only.has(username))
    .filter(username => {
      if (options.cutoffDate === undefined) {
        return true
      }
      const latestActivity = activityByUsername.get(username)?.latestActivity
      return latestActivity === undefined || latestActivity < options.cutoffDate
    })
    .sort((a, b) => {
      const aActivity = activityByUsername.get(a)?.latestActivity?.valueOf()
      const bActivity = activityByUsername.get(b)?.latestActivity?.valueOf()
      if (aActivity === undefined && bActivity === undefined) {
        return a.localeCompare(b)
      }
      if (aActivity === undefined) {
        return -1
      }
      if (bActivity === undefined) {
        return 1
      }
      return aActivity - bActivity || a.localeCompare(b)
    })

  return options.limit === undefined
    ? candidates
    : candidates.slice(0, options.limit)
}

export function updateMembersConfig(
  config: Config,
  usernames: string[],
  publicRepoAccess: PublicRepoAccess,
  organizationMembership: OrganizationMembership
): string[] {
  const targets = new Set(usernames.map(username => username.toLowerCase()))
  const repositories = new Map(
    config
      .getResources(Repository)
      .map(repository => [repository.name.toLowerCase(), repository])
  )
  const accessBefore = getAccessSummaryFrom(config)
  const retainedPublicAccess = new Map<
    string,
    Map<string, RepositoryCollaboratorPermission>
  >()

  if (publicRepoAccess === 'retain') {
    for (const username of targets) {
      const userAccess = accessBefore[username]
      if (userAccess === undefined) {
        continue
      }
      for (const [repository, access] of Object.entries(
        userAccess.repositories
      )) {
        const configRepository = repositories.get(repository)
        if (
          configRepository?.archived ||
          access.visibility !== Visibility.Public
        ) {
          continue
        }
        const retainedRepositories =
          retainedPublicAccess.get(username) ?? new Map()
        const current = retainedRepositories.get(repository)
        retainedRepositories.set(
          repository,
          (current === undefined
            ? access.permission
            : betterPermission(
                current,
                access.permission
              )) as RepositoryCollaboratorPermission
        )
        retainedPublicAccess.set(username, retainedRepositories)
      }
    }
  }

  for (const teamMember of config.getResources(TeamMember)) {
    if (targets.has(teamMember.username.toLowerCase())) {
      core.info(`Removing ${teamMember.username} from ${teamMember.team} team`)
      config.removeResource(teamMember)
    }
  }

  for (const collaborator of config.getResources(RepositoryCollaborator)) {
    if (targets.has(collaborator.username.toLowerCase())) {
      core.info(
        `Removing ${collaborator.username} from ${collaborator.repository} repository`
      )
      config.removeResource(collaborator)
    }
  }

  for (const [username, retainedRepositories] of retainedPublicAccess) {
    for (const [repository, permission] of retainedRepositories) {
      core.info(
        `Retaining ${username} ${permission} access to public repository ${repository}`
      )
      config.addResource(
        new RepositoryCollaborator(repository, username, permission)
      )
    }
  }

  if (organizationMembership === 'remove') {
    for (const member of config.getResources(Member)) {
      if (targets.has(member.username.toLowerCase())) {
        core.info(`Removing ${member.username} from the organization`)
        config.removeResource(member)
      }
    }
  }

  return Array.from(targets).sort()
}

function latestActivityByUser(activities: ActivityRecord[]): MemberActivity[] {
  const latest = new Map<string, Date>()
  for (const activity of activities) {
    const username = activity.username.toLowerCase()
    const previous = latest.get(username)
    if (previous === undefined || activity.createdAt > previous) {
      latest.set(username, activity.createdAt)
    }
  }
  return Array.from(latest.entries()).map(([username, latestActivity]) => ({
    username,
    latestActivity
  }))
}

async function collectActivities(since: Date): Promise<MemberActivity[]> {
  const github = await GitHub.getGitHub()
  const [
    githubRepositoryActivities,
    githubRepositoryIssues,
    githubRepositoryPullRequestReviewComments,
    githubRepositoryIssueComments,
    githubRepositoryCommitComments
  ] = await Promise.all([
    github.listRepositoryActivities(since),
    github.listRepositoryIssues(since),
    github.listRepositoryPullRequestReviewComments(since),
    github.listRepositoryIssueComments(since),
    github.listRepositoryCommitComments(since)
  ])

  return latestActivityByUser(
    [
      ...githubRepositoryActivities.map(({activity}) => ({
        username: activity.actor?.login,
        createdAt: new Date(activity.timestamp)
      })),
      ...githubRepositoryIssues.map(({issue}) => ({
        username: issue.user?.login,
        createdAt: new Date(issue.created_at)
      })),
      ...githubRepositoryPullRequestReviewComments.map(({comment}) => ({
        username: comment.user?.login,
        createdAt: new Date(comment.created_at)
      })),
      ...githubRepositoryIssueComments.map(({comment}) => ({
        username: comment.user?.login,
        createdAt: new Date(comment.created_at)
      })),
      ...githubRepositoryCommitComments.map(({comment}) => ({
        username: comment.user?.login,
        createdAt: new Date(comment.created_at)
      }))
    ]
      .filter(
        (
          activity
        ): activity is {
          username: string
          createdAt: Date
        } => activity.username !== undefined
      )
      .filter(activity => !Number.isNaN(activity.createdAt.valueOf()))
  )
}

async function run(): Promise<void> {
  const cutoffDate = parseCutoffDate(process.env.CUTOFF_DATE)
  const limit = parseLimit(process.env.LIMIT)
  const ignore = parseUserList(process.env.IGNORE)
  const only = parseUserList(process.env.ONLY)
  const publicRepoAccess = parsePublicRepoAccess(process.env.PUBLIC_REPO_ACCESS)
  const organizationMembership = parseOrganizationMembership(
    process.env.ORGANIZATION_MEMBERSHIP || 'keep'
  )

  const config = Config.FromPath()
  const activities =
    cutoffDate === undefined
      ? []
      : await collectActivities(limit === undefined ? cutoffDate : new Date(0))
  const selectedMembers = selectMembersForUpdate(config, activities, {
    cutoffDate,
    limit,
    ignore,
    only,
    publicRepoAccess,
    organizationMembership
  })
  const affectedUsers = updateMembersConfig(
    config,
    selectedMembers,
    publicRepoAccess,
    organizationMembership
  )

  config.save()

  core.setOutput('affected-users', affectedUsers.join(', '))
  core.setOutput('affected-users-json', JSON.stringify(affectedUsers))
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run()
}
