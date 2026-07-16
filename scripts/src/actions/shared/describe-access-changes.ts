import {Config} from '../../yaml/config.js'
import {State} from '../../terraform/state.js'
import diff from 'deep-diff'
import * as core from '@actions/core'
import {
  categorizeAccessSummary,
  formatAccessSummarySection,
  formatRepositoryAccess,
  getAccessSummaryFrom,
  getComparableAccessSummary,
  RepositoryAccess
} from './access-summary.js'

function repositoryLabel(
  repository: string,
  afterSummary: ReturnType<typeof getAccessSummaryFrom>,
  beforeSummary: ReturnType<typeof getAccessSummaryFrom>
): string {
  const access =
    Object.values(afterSummary)
      .map(user => user.repositories[repository])
      .find(Boolean) ??
    Object.values(beforeSummary)
      .map(user => user.repositories[repository])
      .find(Boolean) ??
    ({permission: 'pull', visibility: 'private'} as RepositoryAccess)

  return formatRepositoryAccess(repository, access)
}

export async function runDescribeAccessChanges(): Promise<string> {
  const state = await State.New()
  const config = Config.FromPath()

  return describeAccessReport(state, config)
}

export function describeAccessReport(state: State, config: Config): string {
  const accessChangesDescription = describeAccessChanges(state, config)
  const after = getAccessSummaryFrom(config)
  const categories = categorizeAccessSummary(after)

  return [
    'The following access changes will be introduced as a result of applying the plan:',
    '',
    '<details><summary>Access Changes</summary>',
    '',
    '```',
    accessChangesDescription,
    '```',
    '',
    '</details>',
    '',
    formatAccessSummarySection(
      'Outside collaborators',
      categories.outsideCollaborators,
      after
    ),
    '',
    formatAccessSummarySection(
      'Potential outside collaborators',
      categories.potentialOutsideCollaborators,
      after
    ),
    '',
    formatAccessSummarySection(
      'Potential no members',
      categories.potentialNoMembers,
      after
    ),
    '',
    formatAccessSummarySection(
      'Any other members',
      categories.anyOtherMembers,
      after
    )
  ].join('\n')
}

export function describeAccessChanges(state: State, config: Config): string {
  const before = getComparableAccessSummary(state)
  const after = getComparableAccessSummary(config)
  const beforeWithVisibility = getAccessSummaryFrom(state)
  const afterWithVisibility = getAccessSummaryFrom(config)

  core.info(JSON.stringify({before, after}, null, 2))

  const changes = diff(before, after) || []

  core.debug(JSON.stringify(changes, null, 2))

  const changesByUser: Record<string, typeof changes> = {}
  for (const change of changes) {
    if (change.path === undefined) {
      throw new Error(`Change ${change.kind} has no path`)
    }
    const path = change.path
    changesByUser[String(path[0])] = changesByUser[String(path[0])] || []
    changesByUser[String(path[0])].push(change)
  }

  const lines = []
  for (const [username, userChanges] of Object.entries(changesByUser)) {
    lines.push(`User ${username}:`)
    for (const change of userChanges) {
      if (change.path === undefined) {
        throw new Error(`Change ${change.kind} has no path`)
      }
      const path = change.path
      switch (change.kind) {
        case 'E':
          if (path[1] === 'role') {
            if (change.lhs === undefined) {
              lines.push(
                `  - will join the organization as a ${change.rhs} (remind them to accept the email invitation)`
              )
            } else if (change.rhs === undefined) {
              lines.push('  - will leave the organization')
            } else {
              lines.push(
                `  - will have the role in the organization change from ${change.lhs} to ${change.rhs}`
              )
            }
          } else {
            const repository = String(path[2])
            lines.push(
              `  - will have the permission to ${repositoryLabel(
                repository,
                afterWithVisibility,
                beforeWithVisibility
              )} change from ${change.lhs} to ${change.rhs}`
            )
          }
          break
        case 'N':
          if (path.length === 1) {
            if (change.rhs.role) {
              lines.push(
                `  - will join the organization as a ${change.rhs.role} (remind them to accept the email invitation)`
              )
            }
            if (change.rhs.repositories) {
              const repositories = change.rhs.repositories as unknown as Record<
                string,
                {permission: string}
              >
              for (const [repository, {permission}] of Object.entries(
                repositories
              )) {
                lines.push(
                  `  - will gain ${permission} permission to ${repositoryLabel(
                    repository,
                    afterWithVisibility,
                    beforeWithVisibility
                  )}`
                )
              }
            }
          } else {
            const repository = String(path[2])
            lines.push(
              `  - will gain ${change.rhs.permission} permission to ${repositoryLabel(
                repository,
                afterWithVisibility,
                beforeWithVisibility
              )}`
            )
          }
          break
        case 'D':
          if (path.length === 1) {
            if (change.lhs.role) {
              lines.push('  - will leave the organization')
            }
            if (change.lhs.repositories) {
              const repositories = change.lhs.repositories as unknown as Record<
                string,
                {permission: string}
              >
              for (const [repository, {permission}] of Object.entries(
                repositories
              )) {
                lines.push(
                  `  - will lose ${permission} permission to ${repositoryLabel(
                    repository,
                    afterWithVisibility,
                    beforeWithVisibility
                  )}`
                )
              }
            }
          } else {
            const repository = String(path[2])
            lines.push(
              `  - will lose ${change.lhs.permission} permission to ${repositoryLabel(
                repository,
                afterWithVisibility,
                beforeWithVisibility
              )}`
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
