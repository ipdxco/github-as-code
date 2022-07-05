import 'reflect-metadata'
import * as terraform from './terraform'
import * as yaml from './yaml'

async function run(): Promise<void> {
  const organization = await terraform.getWorkspace()
  const managedResourceTypes = terraform.getManagedResourceTypes()
  const ignoredChanges = terraform.getIgnoredChanges()

  await terraform.refreshState()

  const state = await terraform.getState()
  const syncedState = await state.sync(managedResourceTypes)

  const config = yaml.getConfig(organization)
  const syncedConfig = config.sync(syncedState, ignoredChanges)

  yaml.saveConfig(organization, syncedConfig)
}

run()
