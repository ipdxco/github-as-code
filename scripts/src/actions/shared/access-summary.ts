import {Config} from '../../yaml/config.js'
import {State} from '../../terraform/state.js'
import {RepositoryCollaborator} from '../../resources/repository-collaborator.js'
import {Member} from '../../resources/member.js'
import {TeamMember} from '../../resources/team-member.js'
import {RepositoryTeam} from '../../resources/repository-team.js'
import {Repository, Visibility} from '../../resources/repository.js'

export type RepositoryAccess = {
  permission: string
  visibility: Visibility
  grants: RepositoryAccessGrant[]
}

export type RepositoryAccessGrant = {
  source: 'direct' | 'team'
  permission: string
  team?: string
}

export type UserAccess = {
  role?: string
  isMember: boolean
  isOutsideCollaborator: boolean
  repositories: Record<string, RepositoryAccess>
  directRepositories: Record<string, RepositoryAccess>
  teams: string[]
  hasKeepComment: boolean
}

export type AccessSummary = Record<string, UserAccess>

export type AccessCategory =
  | 'outsideCollaborators'
  | 'potentialOutsideCollaborators'
  | 'potentialNoMembers'
  | 'anyOtherMembers'

export type AccessCategories = Record<AccessCategory, string[]>

export const permissions = ['admin', 'maintain', 'push', 'triage', 'pull']

export function betterPermission(current: string, next: string): string {
  return permissions.indexOf(next) < permissions.indexOf(current)
    ? next
    : current
}

function betterGrant(
  current: RepositoryAccessGrant | undefined,
  next: RepositoryAccessGrant
): RepositoryAccessGrant {
  return current === undefined ||
    permissions.indexOf(next.permission) <
      permissions.indexOf(current.permission)
    ? next
    : current
}

function addRepositoryGrant(
  repositories: Record<string, RepositoryAccess>,
  repository: string,
  visibility: Visibility,
  grant: RepositoryAccessGrant
): void {
  const current = repositories[repository]
  if (current === undefined) {
    repositories[repository] = {
      permission: grant.permission,
      visibility,
      grants: [grant]
    }
  } else {
    current.permission = betterPermission(current.permission, grant.permission)
    current.grants.push(grant)
  }
}

function sortRepositoryAccess(access: RepositoryAccess): RepositoryAccess {
  return {
    ...access,
    grants: access.grants.sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b))
    )
  }
}

export function parseUserList(source?: string): string[] {
  return Array.from(
    new Set(
      (source || '')
        .split(/[\s,]+/)
        .map(username => username.trim().toLowerCase())
        .filter(username => username !== '')
    )
  ).sort()
}

export function hasKeepComment(config: Config, member: Member): boolean {
  const node = config.document.getIn(
    member.getSchemaPath(config.get()),
    true
  ) as {comment?: string} | undefined
  return node?.comment?.includes('KEEP:') ?? false
}

export function getAccessSummaryFrom(source: State | Config): AccessSummary {
  const members = source.getResources(Member)
  const teamMembers = source.getResources(TeamMember)
  const teamRepositories = source.getResources(RepositoryTeam)
  const repositoryCollaborators = source.getResources(RepositoryCollaborator)
  const repositories = source.getResources(Repository)

  const repositoryVisibility = new Map(
    repositories.map(repository => [
      repository.name.toLowerCase(),
      repository.visibility ?? Visibility.Private
    ])
  )
  const archivedRepositories = repositories
    .filter(repository => repository.archived)
    .map(repository => repository.name.toLowerCase())

  const usernames = new Set<string>([
    ...members.map(member => member.username.toLowerCase()),
    ...teamMembers.map(teamMember => teamMember.username.toLowerCase()),
    ...repositoryCollaborators.map(collaborator =>
      collaborator.username.toLowerCase()
    )
  ])

  const accessSummary: AccessSummary = {}

  for (const username of Array.from(usernames).sort()) {
    const member = members.find(
      candidate => candidate.username.toLowerCase() === username
    )
    const role = member?.role
    const teams = teamMembers
      .filter(teamMember => teamMember.username.toLowerCase() === username)
      .map(teamMember => teamMember.team.toLowerCase())
      .sort()
    const repositoryCollaborator = repositoryCollaborators
      .filter(collaborator => collaborator.username.toLowerCase() === username)
      .filter(
        collaborator =>
          !archivedRepositories.includes(collaborator.repository.toLowerCase())
      )
    const teamRepository = teamRepositories
      .filter(repository => teams.includes(repository.team.toLowerCase()))
      .filter(
        repository =>
          !archivedRepositories.includes(repository.repository.toLowerCase())
      )

    const repositories: Record<string, RepositoryAccess> = {}
    const directRepositories: Record<string, RepositoryAccess> = {}

    for (const rc of repositoryCollaborator) {
      const repository = rc.repository.toLowerCase()
      const access = {
        permission: rc.permission,
        visibility: repositoryVisibility.get(repository) ?? Visibility.Private,
        grants: [
          {
            source: 'direct' as const,
            permission: rc.permission
          }
        ]
      }
      directRepositories[repository] = {
        ...access,
        grants: [
          betterGrant(
            directRepositories[repository]?.grants[0],
            access.grants[0]
          )
        ],
        permission: directRepositories[repository]
          ? betterPermission(
              directRepositories[repository].permission,
              access.permission
            )
          : access.permission
      }
      addRepositoryGrant(
        repositories,
        repository,
        access.visibility,
        access.grants[0]
      )
    }

    for (const tr of teamRepository) {
      const repository = tr.repository.toLowerCase()
      addRepositoryGrant(
        repositories,
        repository,
        repositoryVisibility.get(repository) ?? Visibility.Private,
        {
          source: 'team',
          permission: tr.permission,
          team: tr.team.toLowerCase()
        }
      )
    }

    const hasKeep =
      source instanceof Config && member !== undefined
        ? hasKeepComment(source, member)
        : false

    const isMember = role !== undefined
    const isOutsideCollaborator =
      !isMember && Object.keys(directRepositories).length > 0

    if (isMember || isOutsideCollaborator || teams.length > 0) {
      accessSummary[username] = {
        role,
        isMember,
        isOutsideCollaborator,
        repositories,
        directRepositories: Object.fromEntries(
          Object.entries(directRepositories).map(([repository, access]) => [
            repository,
            sortRepositoryAccess(access)
          ])
        ),
        teams,
        hasKeepComment: hasKeep
      }
      accessSummary[username].repositories = Object.fromEntries(
        Object.entries(accessSummary[username].repositories).map(
          ([repository, access]) => [repository, sortRepositoryAccess(access)]
        )
      )
    }
  }

  return deepSort(accessSummary)
}

export function getComparableAccessSummary(source: State | Config): Record<
  string,
  {
    role?: string
    repositories: Record<
      string,
      {permission: string; grants: RepositoryAccessGrant[]}
    >
  }
> {
  return Object.fromEntries(
    Object.entries(getAccessSummaryFrom(source)).map(([username, access]) => [
      username,
      {
        role: access.role,
        repositories: Object.fromEntries(
          Object.entries(access.repositories).map(([repository, value]) => [
            repository,
            {
              permission: value.permission,
              grants: value.grants
            }
          ])
        )
      }
    ])
  )
}

export function categorizeAccessSummary(
  summary: AccessSummary
): AccessCategories {
  const categories: AccessCategories = {
    outsideCollaborators: [],
    potentialOutsideCollaborators: [],
    potentialNoMembers: [],
    anyOtherMembers: []
  }

  for (const [username, access] of Object.entries(summary)) {
    const repositories = Object.values(access.repositories)
    if (access.isOutsideCollaborator) {
      categories.outsideCollaborators.push(username)
    } else if (
      access.isMember &&
      !access.hasKeepComment &&
      access.teams.length === 0 &&
      repositories.length > 0 &&
      repositories.every(
        repository => repository.visibility === Visibility.Public
      )
    ) {
      categories.potentialOutsideCollaborators.push(username)
    } else if (
      access.isMember &&
      !access.hasKeepComment &&
      repositories.length === 0
    ) {
      categories.potentialNoMembers.push(username)
    } else if (access.isMember) {
      categories.anyOtherMembers.push(username)
    }
  }

  for (const users of Object.values(categories)) {
    users.sort()
  }

  return categories
}

export function formatRepositoryAccess(
  repository: string,
  access: RepositoryAccess
): string {
  return `${repository} (${access.visibility})`
}

function formatTeams(teams: string[]): string {
  return teams.length === 1 ? `team ${teams[0]}` : `teams ${teams.join(', ')}`
}

export function formatRepositoryAccessDescription(
  repository: string,
  access: RepositoryAccess
): string {
  const directGrant = access.grants.find(grant => grant.source === 'direct')
  const teamGrants = access.grants.filter(grant => grant.source === 'team')
  const repositoryLabel = formatRepositoryAccess(repository, access)

  if (directGrant !== undefined && teamGrants.length === 0) {
    return `direct ${directGrant.permission} permission to ${repositoryLabel}`
  }

  if (directGrant === undefined) {
    const teams = Array.from(
      new Set(teamGrants.map(grant => grant.team).filter(Boolean) as string[])
    ).sort()
    return `${access.permission} permission to ${repositoryLabel} through ${formatTeams(
      teams
    )}`
  }

  const teams = Array.from(
    new Set(teamGrants.map(grant => grant.team).filter(Boolean) as string[])
  ).sort()
  return `effective ${access.permission} permission to ${repositoryLabel} through direct ${directGrant.permission} permission and ${formatTeams(
    teams
  )}`
}

export function formatAccessSummarySection(
  title: string,
  users: string[],
  summary: AccessSummary
): string {
  const lines = [
    `<details><summary>${title}</summary>`,
    '',
    `Affected users: ${users.length > 0 ? users.join(', ') : 'none'}`,
    '',
    '```'
  ]

  if (users.length === 0) {
    lines.push('No users in this section')
  }

  for (const username of users) {
    const access = summary[username]
    const kind = access.isOutsideCollaborator
      ? 'outside collaborator'
      : 'member'
    lines.push(`User ${username} (${kind}):`)
    const repositories = Object.entries(access.repositories)
    if (repositories.length === 0) {
      lines.push('  - has no repository access')
    } else {
      for (const [repository, repositoryAccess] of repositories) {
        lines.push(
          `  - has ${formatRepositoryAccessDescription(
            repository,
            repositoryAccess
          )}`
        )
      }
    }
  }

  lines.push('```', '', '</details>')
  return lines.join('\n')
}

// deep sort object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepSort(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(deepSort)
  } else if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = deepSort(obj[key])
    }
    return sorted
  } else {
    return obj
  }
}
