import {Resource, ResourceConstructors} from './resources/resource.js'
import {State} from './terraform/state.js'
import {Id} from './terraform/schema.js'
import {Config} from './yaml/config.js'

export async function runSync(): Promise<void> {
  const state = await State.New()
  const config = Config.FromPath()

  await sync(state, config)

  config.save()
}

export async function sync(state: State, config: Config): Promise<void> {
  const resources: [Id, Resource][] = []
  for (const resourceClass of ResourceConstructors) {
    if (!state.isIgnored(resourceClass)) {
      const oldResources = config.getResources(resourceClass)
      const newResources = await resourceClass.FromGitHub(oldResources)
      resources.push(...newResources)
    }
  }

  await state.sync(resources)
  await state.refresh()

  const syncedResources = state.getAllResources()
  config.sync(syncedResources)
}
