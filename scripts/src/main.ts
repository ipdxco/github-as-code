import 'reflect-metadata'
import * as terraform from './terraform'
import * as yaml from './yaml'

async function run(): Promise<void> {
  // retrieves the value of locals.resource_types from terraform
  const managedResourceTypes = terraform.getManagedResourceTypes()
  // retrieves the value of resource.*.lifecycle.ignore_changes from terraform
  const ignoredChanges = terraform.getIgnoredChanges()

  // updates terraform state to reflect the current GitHub state
  await terraform.refreshState()

  const state = await terraform.getState()
  const config = yaml.getConfig()

  // imports/removes managed resources as needed
  const syncedState = await state.sync(config, managedResourceTypes)
  // adds/removes/updates yaml config as needed
  const syncedConfig = await config.sync(syncedState, ignoredChanges)

  syncedConfig.sort()
  syncedConfig.save()
}

run()
