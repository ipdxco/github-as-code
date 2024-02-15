import {Config} from '../../yaml/config'
import { State } from '../../terraform/state'
import { RepositoryCollaborator } from '../../resources/repository-collaborator'
import { Member } from '../../resources/member'
import { TeamMember } from '../../resources/team-member'
import { RepositoryTeam } from '../../resources/repository-team'

function getAccessSummaryFrom(source: State | Config): Record<string, any> {
  const members = source.getResources(Member)
  const teamMembers = source.getResources(TeamMember)
  const teamRepositories = source.getResources(RepositoryTeam)
  const repositoryCollaborators = source.getResources(RepositoryCollaborator)

  const usernames = new Set<string>([
    ...members.map(member => member.username),
    ...repositoryCollaborators.map(collaborator => collaborator.username),
  ])

  const accessSummary: Record<string, any> = {}

  for (const username of usernames) {
    const role = members.find(member => member.username === username)?.role
    const teams = teamMembers.filter(teamMember => teamMember.username === username).map(teamMember => teamMember.team)
    const repositoryCollaborator = repositoryCollaborators.filter(repositoryCollaborator => repositoryCollaborator.username === username)
    const teamRepository = teamRepositories.filter(teamRepository => teams.includes(teamRepository.team))

    const repositories: Record<string, any> = {}

    for (const rc of repositoryCollaborator) {
      repositories[rc.repository] = repositories[rc.repository] ?? []
      repositories[rc.repository].push({permission: rc.permission, type: 'collaborator'})
    }

    for (const tr of teamRepository) {
      repositories[tr.repository] = repositories[tr.repository] ?? []
      repositories[tr.repository].push({permission: tr.permission, type: 'team', team: tr.team})
    }

    accessSummary[username] = {
      role,
      teams,
      repositories
    }
  }

  return accessSummary
}

function describeAccessSummary(accessSummary: Record<string, any>): string {
  const lines: string[] = []
  const permissions = ['admin', 'maintain', 'push', 'triage', 'pull']

  for (const [username, summary] of Object.entries(accessSummary)) {
    lines.push(`User @${username}:`)
    if (summary.role !== undefined) {
      lines.push(`  - is a ${summary.role} of the organization`)
    } else {
      lines.push(`  - is not a member of the organization`)
    }
    if (Object.keys(summary.repositories).length > 0) {
      for (const permission of permissions) {
        const buffer = []
        const index = permission.indexOf(permission)
        for (const [repository, accessList] of Object.entries(summary.repositories) as [string, any][]) {
          const access = accessList.find((a: any) => a.permission === permission)
          if (access !== undefined) {
            const higher = accessList.filter((a: any) => permissions.indexOf(a.permission) < index)
            if (higher.length === 0) {
              if (access.type === 'collaborator') {
                buffer.push(`    - ${repository} as a direct collaborator`)
              } else {
                buffer.push(`    - ${repository} through team @${access.team}`)
              }
            }
          }
        }
        if (buffer.length > 0) {
          lines.push(`  - has ${permission} access to:`)
          lines.push(...buffer)
        } else {
          lines.push(`  - has no ${permission} access to any repository`)
        }
      }
    } else {
      lines.push(`  - has no access to any repository`)
    }
  }

  return lines.join('\n')
}

export async function getAccessSummaryDescription(): Promise<string> {
  const config = Config.FromPath()

  const accessSummary = getAccessSummaryFrom(config)

  const description = describeAccessSummary(accessSummary)

  return description
}
