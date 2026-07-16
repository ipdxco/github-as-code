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
import {Repository} from '../resources/repository.js'

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
