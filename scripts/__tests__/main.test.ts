import 'reflect-metadata'
import * as terraform from '../src/terraform'
import * as yaml from '../src/yaml'
import {env} from '../src/utils'

test('e2e synchronization', async () => {
  env.TF_EXEC = false
  env.TF_LOCK = false
  env.TF_WORKING_DIR = '__tests__/resources/terraform'
  env.GITHUB_DIR = '__tests__/resources/github'
  env.FILES_DIR = '__tests__/resources/files'

  const organization = await terraform.getWorkspace()
  const managedResourceTypes = terraform.getManagedResourceTypes()
  const ignoredChanges = terraform.getIgnoredChanges()

  await terraform.refreshState()

  const state = await terraform.getState()
  const config = yaml.getConfig(organization)

  const syncedState = await state.sync(config, managedResourceTypes)
  const syncedConfig = config.sync(syncedState, ignoredChanges)

  config.sort()

  expect(syncedConfig.toString()).toEqual(
    yaml.getConfig(organization).toString()
  )
})
