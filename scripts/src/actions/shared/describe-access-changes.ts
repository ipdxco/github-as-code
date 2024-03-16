import {Config} from '../../yaml/config'
import {State} from '../../terraform/state'
import {RepositoryCollaborator} from '../../resources/repository-collaborator'
import {Member} from '../../resources/member'
import {TeamMember} from '../../resources/team-member'
import {RepositoryTeam} from '../../resources/repository-team'
import {diff} from 'deep-diff'
import * as core from '@actions/core'
import {Repository} from '../../resources/repository'

type AccessSummary = Record<
  string,
  {
    role?: string
    repositories: Record<string, {permission: string}>
  }
>

function getAccessSummaryFrom(source: State | Config): AccessSummary {
  const members = source.getResources(Member)
  const teamMembers = source.getResources(TeamMember)
  const teamRepositories = source.getResources(RepositoryTeam)
  const repositoryCollaborators = source.getResources(RepositoryCollaborator)

  const archivedRepositories = source
    .getResources(Repository)
    .filter(repository => repository.archived)
    .map(repository => repository.name.toLowerCase())

  const usernames = new Set<string>([
    ...members.map(member => member.username.toLowerCase()),
    ...repositoryCollaborators.map(collaborator => collaborator.username.toLowerCase()),
  ])

  const accessSummary: AccessSummary = {}
  const permissions = ['admin', 'maintain', 'push', 'triage', 'pull']

  for (const username of usernames) {
    const role = members.find(member => member.username.toLowerCase() === username)?.role
    const teams = teamMembers
      .filter(teamMember => teamMember.username.toLowerCase() === username)
      .map(teamMember => teamMember.team.toLowerCase())
    const repositoryCollaborator = repositoryCollaborators
      .filter(
        repositoryCollaborator => repositoryCollaborator.username.toLowerCase() === username
      )
      .filter(
        repositoryCollaborator =>
          !archivedRepositories.includes(repositoryCollaborator.repository.toLowerCase())
      )
    const teamRepository = teamRepositories
      .filter(teamRepository => teams.includes(teamRepository.team.toLowerCase()))
      .filter(
        teamRepository =>
          !archivedRepositories.includes(teamRepository.repository.toLowerCase())
      )

    const repositories: Record<string, {permission: string}> = {}

    for (const rc of repositoryCollaborator) {
      const repository = rc.repository.toLowerCase()
      repositories[repository] = repositories[repository] ?? {}
      if (
        !repositories[repository].permission ||
        permissions.indexOf(rc.permission) <
          permissions.indexOf(repositories[repository].permission)
      ) {
        repositories[repository].permission = rc.permission
      }
    }

    for (const tr of teamRepository) {
      const repository = tr.repository.toLowerCase()
      repositories[repository] = repositories[repository] ?? {}
      if (
        !repositories[repository].permission ||
        permissions.indexOf(tr.permission) <
          permissions.indexOf(repositories[repository].permission)
      ) {
        repositories[repository].permission = tr.permission
      }
    }

    if (role !== undefined || Object.keys(repositories).length > 0) {
      accessSummary[username] = {
        role,
        repositories
      }
    }
  }

  return deepSort(accessSummary)
}

// deep sort object
function deepSort(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(deepSort)
  } else if (typeof obj === 'object') {
    const sorted: any = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = deepSort(obj[key])
    }
    return sorted
  } else {
    return obj
  }
}

export async function describeAccessChanges(): Promise<string> {
  const state = await State.New()
  const config = Config.FromPath()

  const before = getAccessSummaryFrom(state)
  const after = getAccessSummaryFrom(config)

  core.info(JSON.stringify({before, after}, null, 2))

  const changes = diff(before, after) || []

  core.debug(JSON.stringify(changes, null, 2))

  const changesByUser: Record<string, any> = {}
  for (const change of changes) {
    const path = change.path!
    changesByUser[path[0]] = changesByUser[path[0]] || []
    changesByUser[path[0]].push(change)
  }

  // iterate over changesByUser and build a description
  const lines = []
  for (const [username, changes] of Object.entries(changesByUser)) {
    lines.push(`User ${username}:`)
    for (const change of changes) {
      const path = change.path!
      switch (change.kind) {
        case 'E':
          if (path[1] === 'role') {
            lines.push(
              `  - will have the role in the organization change from ${change.lhs} to ${change.rhs}`
            )
          } else {
            lines.push(
              `  - will have the permission to ${path[2]} change from ${change.lhs} to ${change.rhs}`
            )
          }
          break
        case 'N':
          if (path.length === 1) {
            if (change.rhs.role) {
              lines.push(
                `  - will join the organization as a ${change.rhs} (remind them to accept the email invitation)`
              )
            }
            if (change.rhs.repositories) {
              for (const repository of Object.keys(change.rhs.repositories)) {
                lines.push(
                  `  - will gain ${change.rhs.repositories[repository].permission} permission to ${repository}`
                )
              }
            }
          } else {
            lines.push(`  - will gain ${change.rhs} permission to ${path[2]}`)
          }
          break
        case 'D':
          if (path.length === 1) {
            if (change.lhs.role) {
              lines.push(`  - will leave the organization`)
            }
            if (change.lhs.repositories) {
              for (const repository of Object.keys(change.lhs.repositories)) {
                lines.push(
                  `  - will lose ${change.lhs.repositories[repository].permission} permission to ${repository}`
                )
              }
            }
          } else {
            lines.push(
              `  - will lose ${change.lhs.permission} permission to ${path[2]}`
            )
          }
          break
      }
    }
  }

  return changes.length > 0
    ? lines.join('\n')
    : 'There will be no access changes'
}
