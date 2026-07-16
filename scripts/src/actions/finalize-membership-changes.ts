import 'reflect-metadata'
import * as core from '@actions/core'
import {pathToFileURL} from 'url'
import {Config} from '../yaml/config.js'
import {GitHub} from '../github.js'
import {
  categorizeAccessSummary,
  getAccessSummaryFrom,
  parseUserList
} from './shared/access-summary.js'

export type FinalizeMembershipMode =
  | 'convert-potential-outside-collaborators'
  | 'remove-potential-no-members'
  | 'both'

export type FinalizeMembershipPlan = {
  potentialOutsideCollaborators: string[]
  potentialNoMembers: string[]
}

export function parseFinalizeMembershipMode(
  source?: string
): FinalizeMembershipMode {
  if (
    source === 'convert-potential-outside-collaborators' ||
    source === 'remove-potential-no-members' ||
    source === 'both'
  ) {
    return source
  }
  throw new Error(
    'mode must be convert-potential-outside-collaborators, remove-potential-no-members, or both'
  )
}

export function planFinalizeMembershipChanges(
  config: Config,
  mode: FinalizeMembershipMode,
  ignore: string[],
  only: string[]
): FinalizeMembershipPlan {
  const ignoredUsers = new Set(ignore)
  const onlyUsers = new Set(only)
  const categories = categorizeAccessSummary(getAccessSummaryFrom(config))

  const filter = (users: string[]): string[] =>
    users
      .filter(username => !ignoredUsers.has(username))
      .filter(username => onlyUsers.size === 0 || onlyUsers.has(username))
      .sort()

  return {
    potentialOutsideCollaborators:
      mode === 'remove-potential-no-members'
        ? []
        : filter(categories.potentialOutsideCollaborators),
    potentialNoMembers:
      mode === 'convert-potential-outside-collaborators'
        ? []
        : filter(categories.potentialNoMembers)
  }
}

export function formatFinalizeMembershipPlan(
  plan: FinalizeMembershipPlan
): string {
  return [
    'Potential outside collaborators to convert:',
    plan.potentialOutsideCollaborators.length > 0
      ? plan.potentialOutsideCollaborators
          .map(username => `- ${username}`)
          .join('\n')
      : '- none',
    '',
    'Potential no members to remove:',
    plan.potentialNoMembers.length > 0
      ? plan.potentialNoMembers.map(username => `- ${username}`).join('\n')
      : '- none'
  ].join('\n')
}

async function run(): Promise<void> {
  const mode = parseFinalizeMembershipMode(process.env.MODE || 'both')
  const ignore = parseUserList(process.env.IGNORE)
  const only = parseUserList(process.env.ONLY)
  const shouldApply = process.env.APPLY === 'true'
  const config = Config.FromPath()

  const plan = planFinalizeMembershipChanges(config, mode, ignore, only)
  const affectedUsers = Array.from(
    new Set([...plan.potentialOutsideCollaborators, ...plan.potentialNoMembers])
  ).sort()

  core.info(formatFinalizeMembershipPlan(plan))
  core.setOutput('affected-users', affectedUsers.join(', '))
  core.setOutput('affected-users-json', JSON.stringify(affectedUsers))
  core.setOutput(
    'potential-outside-collaborators-json',
    JSON.stringify(plan.potentialOutsideCollaborators)
  )
  core.setOutput(
    'potential-no-members-json',
    JSON.stringify(plan.potentialNoMembers)
  )

  if (!shouldApply) {
    return
  }

  const github = await GitHub.getGitHub()

  for (const username of plan.potentialOutsideCollaborators) {
    await github.convertMemberToOutsideCollaborator(username)
  }

  for (const username of plan.potentialNoMembers) {
    await github.removeOrganizationMembership(username)
  }

  core.notice(
    'Membership changes are complete. Run the Sync workflow for this organization so Terraform state and YAML config reflect GitHub.'
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run()
}
