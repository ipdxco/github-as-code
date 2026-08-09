import {Config} from '../../yaml/config.js'
import {State} from '../../terraform/state.js'
import * as core from '@actions/core'
import {
  categorizeAccessSummary,
  formatAccessSummarySection,
  formatRepositoryAccessDescription,
  getAccessSummaryFrom
} from './access-summary.js'

const GITHUB_COMMENT_LENGTH_LIMIT = 65000

export async function runDescribeAccessChanges(): Promise<string> {
  const state = await State.New()
  const config = Config.FromPath()

  return describeAccessChangesComment(state, config)
}

export function workflowRunUrl(): string | undefined {
  const serverUrl = process.env.GITHUB_SERVER_URL
  const repository = process.env.GITHUB_REPOSITORY
  const runId = process.env.GITHUB_RUN_ID

  if (
    serverUrl === undefined ||
    repository === undefined ||
    runId === undefined
  ) {
    return undefined
  }

  return `${serverUrl}/${repository}/actions/runs/${runId}`
}

export function describeAccessChangesComment(
  state: State,
  config: Config,
  maxLength = GITHUB_COMMENT_LENGTH_LIMIT,
  runUrl = workflowRunUrl()
): string {
  const accessChangesDescription = describeAccessChanges(state, config)
  const comment = [
    'The following access changes will be introduced as a result of applying the plan:',
    '',
    '<details><summary>Access Changes</summary>',
    '',
    '```',
    accessChangesDescription,
    '```',
    '',
    '</details>'
  ].join('\n')

  if (Buffer.byteLength(comment, 'utf8') < maxLength) {
    return comment
  }

  const destination =
    runUrl === undefined
      ? 'the Fix workflow summary or the access report artifact'
      : `[the Fix workflow summary or access report artifact](${runUrl})`

  return `Access changes are too long to post as a comment. Please inspect ${destination} instead.`
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
  const before = getAccessSummaryFrom(state)
  const after = getAccessSummaryFrom(config)

  core.info(JSON.stringify({before, after}, null, 2))

  const lines = []
  const usernames = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)])
  ).sort()

  for (const username of usernames) {
    const beforeAccess = before[username]
    const afterAccess = after[username]
    const userLines = []

    if (beforeAccess?.role !== afterAccess?.role) {
      if (beforeAccess?.role === undefined && afterAccess?.role !== undefined) {
        userLines.push(
          `  - will join the organization as a ${afterAccess.role} (remind them to accept the email invitation)`
        )
      } else if (
        beforeAccess?.role !== undefined &&
        afterAccess?.role === undefined
      ) {
        userLines.push('  - will leave the organization')
      } else {
        userLines.push(
          `  - will have the role in the organization change from ${beforeAccess?.role} to ${afterAccess?.role}`
        )
      }
    }

    const repositories = Array.from(
      new Set([
        ...Object.keys(beforeAccess?.repositories ?? {}),
        ...Object.keys(afterAccess?.repositories ?? {})
      ])
    ).sort()

    for (const repository of repositories) {
      const beforeRepositoryAccess = beforeAccess?.repositories[repository]
      const afterRepositoryAccess = afterAccess?.repositories[repository]
      if (
        JSON.stringify(beforeRepositoryAccess) ===
        JSON.stringify(afterRepositoryAccess)
      ) {
        continue
      }

      if (
        beforeRepositoryAccess === undefined &&
        afterRepositoryAccess !== undefined
      ) {
        userLines.push(
          `  - will gain ${formatRepositoryAccessDescription(
            repository,
            afterRepositoryAccess
          )}`
        )
      } else if (
        beforeRepositoryAccess !== undefined &&
        afterRepositoryAccess === undefined
      ) {
        userLines.push(
          `  - will lose ${formatRepositoryAccessDescription(
            repository,
            beforeRepositoryAccess
          )}`
        )
      } else if (
        beforeRepositoryAccess !== undefined &&
        afterRepositoryAccess !== undefined
      ) {
        userLines.push(
          `  - will change from having ${formatRepositoryAccessDescription(
            repository,
            beforeRepositoryAccess
          )} to having ${formatRepositoryAccessDescription(
            repository,
            afterRepositoryAccess
          )}`
        )
      }
    }

    if (userLines.length > 0) {
      lines.push(`User ${username}:`, ...userLines)
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'There will be no access changes'
}
