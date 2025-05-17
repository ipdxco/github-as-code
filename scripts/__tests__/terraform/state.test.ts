import 'reflect-metadata'

import {State} from '../../src/terraform/state.js'
import {Resource, ResourceConstructors} from '../../src/resources/resource.js'
import {Repository} from '../../src/resources/repository.js'
import {Id} from '../../src/terraform/schema.js'
import {describe, it, mock} from 'node:test'
import assert from 'node:assert'
import {StateResourceCounts, StateResourcesCount} from '../resources/counts.js'

describe('state', () => {
  it('can retrieve resources from tf state', async () => {
    const config = await State.New()

    const resources = []
    for (const resourceClass of ResourceConstructors) {
      const classResources = config.getResources(resourceClass)
      assert.equal(
        classResources.length,
        StateResourceCounts[resourceClass.name]
      )
      resources.push(...classResources)
    }

    assert.equal(resources.length, StateResourcesCount)
  })

  it('can ignore resource types', async () => {
    const state = await State.New()

    assert.equal(await state.isIgnored(Repository), false)

    mock.module('../../src/terraform/locals.js', {
      namedExports: {
        Locals: {
          getLocals: () => {
            return {
              resource_types: []
            }
          }
        }
      }
    })

    await state.refresh()

    assert.equal(await state.isIgnored(Repository), true)
  })

  it('can ignore resource properties', async () => {
    const config = await State.New()

    const resource = config.getResources(Repository)[0]
    assert.notEqual(resource.description, undefined)

    config['_ignoredProperties'] = {github_repository: ['description']}
    await config.refresh()

    const refreshedResource = config.getResources(Repository)[0]
    assert.equal(refreshedResource.description, undefined)
  })

  it('can add and remove resources through sync', async () => {
    const config = await State.New()

    const addResourceAtMock = mock.fn(config.addResourceAt.bind(config))
    const removeResourceAtMock = mock.fn(config.removeResourceAt.bind(config))

    config.addResourceAt = addResourceAtMock
    config.removeResourceAt = removeResourceAtMock

    const desiredResources: [Id, Resource][] = []
    const resources = config.getAllResources()

    await config.sync(desiredResources)

    assert.equal(addResourceAtMock.mock.calls.length, 0)
    assert.equal(
      removeResourceAtMock.mock.calls.length,
      new Set(resources.map(r => r.getStateAddress().toLowerCase())).size
    )

    addResourceAtMock.mock.resetCalls()
    removeResourceAtMock.mock.resetCalls()

    for (const resource of resources) {
      desiredResources.push(['id', resource])
    }

    await config.sync(desiredResources)
    assert.equal(addResourceAtMock.mock.calls.length, 1) // adding github-mgmt/readme.md
    assert.equal(removeResourceAtMock.mock.calls.length, 1) // removing github-mgmt/README.md

    addResourceAtMock.mock.resetCalls()
    removeResourceAtMock.mock.resetCalls()

    desiredResources.push(['id', new Repository('test')])
    desiredResources.push(['id', new Repository('test2')])
    desiredResources.push(['id', new Repository('test3')])
    desiredResources.push(['id', new Repository('test4')])

    await config.sync(desiredResources)

    assert.equal(
      addResourceAtMock.mock.calls.length,
      1 + desiredResources.length - resources.length
    )
    assert.equal(removeResourceAtMock.mock.calls.length, 1)
  })
})
