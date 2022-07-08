import 'reflect-metadata'
import * as terraform from '../src/terraform'
import * as yaml from '../src/yaml'
import {GitHub} from '../src/github'
import {env} from '../src/utils'

GitHub.github = {
  listMembers: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositories: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeams: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositoryCollaborators: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositoryBranchProtectionRules: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeamRepositories: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeamMembers: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  getRepositoryFile: async (_repository: string, _path: string) => {
    return undefined
  }
} as GitHub

test('e2e synchronization', async () => {
  env.TF_EXEC = false
  env.TF_LOCK = false
  env.TF_WORKING_DIR = '__tests__/resources/terraform'
  env.GITHUB_DIR = '__tests__/resources/github'
  env.FILES_DIR = '__tests__/resources/files'
  env.GITHUB_ORG = 'default'

  const managedResourceTypes = terraform.getManagedResourceTypes()
  const ignoredChanges = terraform.getIgnoredChanges()

  await terraform.refreshState()

  const state = await terraform.getState()
  const config = yaml.parse('{}')

  const syncedState = await state.sync(config, managedResourceTypes)
  const syncedConfig = await config.sync(syncedState, ignoredChanges)

  syncedConfig.sort()

  expect(syncedConfig.toString()).toEqual(yaml.getConfig().toString())
})
