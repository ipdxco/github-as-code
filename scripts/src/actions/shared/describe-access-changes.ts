import {Config} from '../../yaml/config'
import {State} from '../../terraform/state'
import {RepositoryCollaborator} from '../../resources/repository-collaborator'
import {Member} from '../../resources/member'
import {TeamMember} from '../../resources/team-member'
import {RepositoryTeam} from '../../resources/repository-team'
import {diff} from 'deep-diff'
import * as core from '@actions/core'

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

  const usernames = new Set<string>([
    ...members.map(member => member.username),
    ...repositoryCollaborators.map(collaborator => collaborator.username)
  ])

  const accessSummary: AccessSummary = {}
  const permissions = ['admin', 'maintain', 'push', 'triage', 'pull']

  for (const username of usernames) {
    const role = members.find(member => member.username === username)?.role
    const teams = teamMembers
      .filter(teamMember => teamMember.username === username)
      .map(teamMember => teamMember.team)
    const repositoryCollaborator = repositoryCollaborators.filter(
      repositoryCollaborator => repositoryCollaborator.username === username
    )
    const teamRepository = teamRepositories.filter(teamRepository =>
      teams.includes(teamRepository.team)
    )

    const repositories: Record<string, {permission: string}> = {}

    for (const rc of repositoryCollaborator) {
      repositories[rc.repository] = repositories[rc.repository] ?? {}
      if (
        permissions.indexOf(rc.permission) <
        permissions.indexOf(repositories[rc.repository].permission)
      ) {
        repositories[rc.repository].permission = rc.permission
      }
    }

    for (const tr of teamRepository) {
      repositories[tr.repository] = repositories[tr.repository] ?? {}
      if (
        permissions.indexOf(tr.permission) <
        permissions.indexOf(repositories[tr.repository].permission)
      ) {
        repositories[tr.repository].permission = tr.permission
      }
    }

    accessSummary[username] = {
      role,
      repositories
    }
  }

  return accessSummary
}

export async function describeAccessChanges(): Promise<string> {
  const state = await State.New()
  const config = Config.FromPath()

  const before = getAccessSummaryFrom(state)
  const after = getAccessSummaryFrom(config)

  core.info(JSON.stringify({before, after}))

  const changes = diff(before, after) || []

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
            if (change.lhs === undefined) {
              lines.push(
                `  - will join the organization as a ${change.rhs} (remember to accept the email invitation)`
              )
            } else if (change.rhs === undefined) {
              lines.push(`  - will leave the organization`)
            } else {
              lines.push(
                `  - will have the role in the organization change from ${change.lhs} to ${change.rhs}`
              )
            }
          } else {
            lines.push(
              `  - will have the permission to ${path[2]} change from ${change.lhs} to ${change.rhs}`
            )
          }
          break
        case 'N':
          lines.push(`  - will gain ${change.rhs} permission to ${path[2]}`)
          break
        case 'D':
          lines.push(`  - will lose ${change.lhs} permission to ${path[2]}`)
          break
      }
    }
  }

  return changes.length > 0
    ? lines.join('\n')
    : 'There will be no access changes'
}
