import {Resource, ResourceConstructors} from './resources/resource'
import {State} from './terraform/state'
import {Id} from './terraform/schema'
import {Config} from './yaml/config'

export async function sync(state: State, config: Config): Promise<void> {
  const resources: [Id, Resource][] = []
  for (const resourceClass of ResourceConstructors) {
    if (!state.isIgnored(resourceClass)) {
      const oldResources = config.getResources(resourceClass)
      const newResources = await resourceClass.FromGitHub(oldResources)
      for (const [a, b] of newResources) {
        if (!state.isNameIgnored(resourceClass, b.getName())) {
          resources.push([a, b])
        }
        console.log(
          'Ignoring resource of class ' +
            resourceClass.name +
            ' with name ' +
            b.getName()
        )
      }
    }
  }

  await state.sync(resources)
  await state.refresh()

  const syncedResources = state.getAllResources()
  config.sync(syncedResources)
}
