import 'reflect-metadata'

import * as core from '@actions/core'
import {pathToFileURL} from 'url'
import {Config} from '../yaml/config.js'
import {State} from '../terraform/state.js'
import {
  Resource,
  ResourceConstructor,
  ResourceConstructors
} from '../resources/resource.js'
import {Member} from '../resources/member.js'
import {Repository, Visibility} from '../resources/repository.js'
import {TeamMember} from '../resources/team-member.js'
import {RepositoryCollaborator} from '../resources/repository-collaborator.js'

const ALLOW_DESTROY_RESOURCE_CLASSES: ResourceConstructor<Resource>[] = [
  Member,
  Repository
]

type Mode = 'read' | 'write'

type Matrix = {
  include: {
    workspace: string
    environment: string
  }[]
}

function getStateAddress(resource: Resource): string {
  return resource.getStateAddress().toLowerCase()
}

function hasMissingResources<T extends Resource>(
  config: Config,
  state: State,
  resourceClass: ResourceConstructor<T>
): boolean {
  const desiredAddresses = new Set(
    config.getResources(resourceClass).map(getStateAddress)
  )
  return state
    .getResources(resourceClass)
    .some(resource => !desiredAddresses.has(getStateAddress(resource)))
}

export async function hasAllowDestroyChange(
  config: Config,
  state: State
): Promise<boolean> {
  for (const resourceClass of ALLOW_DESTROY_RESOURCE_CLASSES) {
    if (
      ResourceConstructors.includes(resourceClass) &&
      !(await state.isIgnored(resourceClass)) &&
      hasMissingResources(config, state, resourceClass)
    ) {
      return true
    }
  }

  return false
}

export async function validateRemovedMembersHaveNoDanglingAccess(
  config: Config,
  state: State
): Promise<void> {
  if (await state.isIgnored(Member)) {
    return
  }

  const desiredMembers = new Set(
    config.getResources(Member).map(member => member.username.toLowerCase())
  )
  const removedMembers = state
    .getResources(Member)
    .map(member => member.username.toLowerCase())
    .filter(username => !desiredMembers.has(username))

  if (removedMembers.length === 0) {
    return
  }

  const repositoryVisibility = new Map(
    [...state.getResources(Repository), ...config.getResources(Repository)].map(
      repository => [
        repository.name.toLowerCase(),
        repository.visibility ?? Visibility.Private
      ]
    )
  )
  const teamMembers = config.getResources(TeamMember)
  const repositoryCollaborators = config.getResources(RepositoryCollaborator)
  const errors: string[] = []

  for (const username of removedMembers.sort()) {
    const teams = teamMembers
      .filter(teamMember => teamMember.username.toLowerCase() === username)
      .map(teamMember => teamMember.team.toLowerCase())
      .sort()
    const privateRepositories = repositoryCollaborators
      .filter(collaborator => collaborator.username.toLowerCase() === username)
      .filter(
        collaborator =>
          (repositoryVisibility.get(collaborator.repository.toLowerCase()) ??
            Visibility.Private) === Visibility.Private
      )
      .map(collaborator => collaborator.repository.toLowerCase())
      .sort()

    if (teams.length > 0) {
      errors.push(
        `${username} is still a member of ${teams.length === 1 ? 'team' : 'teams'} ${teams.join(
          ', '
        )}`
      )
    }

    if (privateRepositories.length > 0) {
      errors.push(
        `${username} still has direct access to private ${privateRepositories.length === 1 ? 'repository' : 'repositories'} ${privateRepositories.join(
          ', '
        )}`
      )
    }
  }

  if (errors.length > 0) {
    throw new Error(
      [
        'Cannot remove organization members while leaving dangling access:',
        ...errors.map(error => `- ${error}`)
      ].join('\n')
    )
  }
}

export function getEnvironment(mode: Mode, allowDestroy: boolean): string {
  return allowDestroy ? `${mode}-allow-destroy` : mode
}

export async function classifyWorkspaces({
  mode,
  workspaces,
  githubDir
}: {
  mode: Mode
  workspaces: string[]
  githubDir: string
}): Promise<Matrix> {
  const include = []
  const originalWorkspace = process.env.TF_WORKSPACE

  try {
    for (const workspace of workspaces) {
      process.env.TF_WORKSPACE = workspace
      const config = Config.FromPath(`${githubDir}/${workspace}.yml`)
      const state = await State.New()
      await validateRemovedMembersHaveNoDanglingAccess(config, state)
      const allowDestroy = await hasAllowDestroyChange(config, state)
      const environment = getEnvironment(mode, allowDestroy)
      core.info(`${workspace}: ${environment}`)
      include.push({workspace, environment})
    }
  } finally {
    if (originalWorkspace === undefined) {
      delete process.env.TF_WORKSPACE
    } else {
      process.env.TF_WORKSPACE = originalWorkspace
    }
  }

  return {include}
}

async function run(): Promise<void> {
  const mode = (process.env.MODE ?? 'read') as Mode
  if (mode !== 'read' && mode !== 'write') {
    throw new Error(`MODE must be one of "read" or "write", got "${mode}"`)
  }

  const workspaces = JSON.parse(process.env.WORKSPACES?.trim() || '[]')
  if (!Array.isArray(workspaces)) {
    throw new Error('WORKSPACES must be a JSON array')
  }

  const matrix = await classifyWorkspaces({
    mode,
    workspaces,
    githubDir: process.env.GITHUB_DIR ?? '../github'
  })

  core.setOutput('matrix', JSON.stringify(matrix))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => core.setFailed(error))
}
