import 'reflect-metadata'

import {State} from '../../src/terraform/state'
import {Resource, ResourceConstructors} from '../../src/resources/resource'
import {Repository} from '../../src/resources/repository'
import {Id} from '../../src/terraform/schema'

test('can retrieve resources from tf state', async () => {
  const config = await State.New()

  const resources = []
  for (const resourceClass of ResourceConstructors) {
    const classResources = config.getResources(resourceClass)
    expect(classResources).toHaveLength(
      global.ResourceCounts[resourceClass.name]
    )
    resources.push(...classResources)
  }

  expect(resources).toHaveLength(global.ResourcesCount)
})

test('can ignore resource types', async () => {
  const config = await State.New()

  expect(config.isIgnored(Repository)).toBe(false)

  config['_ignoredTypes'] = ['github_repository']
  await config.refresh()

  expect(config.isIgnored(Repository)).toBe(true)
})

test('can ignore resource properties', async () => {
  const config = await State.New()

  const resource = config.getResources(Repository)[0]
  expect(resource.description).toBeDefined()

  config['_ignoredProperties'] = {github_repository: ['description']}
  await config.refresh()

  const refreshedResource = config.getResources(Repository)[0]
  expect(refreshedResource.description).toBeUndefined()
})

test('can add and remove resources through sync', async () => {
  const config = await State.New()

  let addResourceSpy = jest.spyOn(config, 'addResource')
  let removeResourceAtSpy = jest.spyOn(config, 'removeResourceAt')

  let desiredResources: [Id, Resource][] = []
  let resources = config.getAllResources()

  await config.sync(desiredResources)

  expect(addResourceSpy).not.toHaveBeenCalled()
  expect(removeResourceAtSpy).toHaveBeenCalledTimes(global.UniqueResourcesCount)
  addResourceSpy.mockReset()
  removeResourceAtSpy.mockReset()

  for (const resource of resources) {
    desiredResources.push(['id', resource])
  }

  await config.sync(desiredResources)
  expect(addResourceSpy).toHaveBeenCalledTimes(1) // adding github-mgmt/readme.md
  expect(removeResourceAtSpy).toHaveBeenCalledTimes(1) // removing github-mgmt/README.md
  addResourceSpy.mockReset()
  removeResourceAtSpy.mockReset()

  desiredResources.push(['id', new Repository('test')])
  desiredResources.push(['id', new Repository('test2')])
  desiredResources.push(['id', new Repository('test3')])
  desiredResources.push(['id', new Repository('test4')])

  await config.sync(desiredResources)
  expect(addResourceSpy).toHaveBeenCalledTimes(
    1 + desiredResources.length - resources.length
  )
  expect(removeResourceAtSpy).toHaveBeenCalledTimes(1)
})
