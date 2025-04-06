import 'reflect-metadata'

import * as YAML from 'yaml'

import * as config from '../src/yaml/config'
import * as state from '../src/terraform/state'
import {sync} from '../src/sync'
import {GitHub} from '../src/github'
import env from '../src/env'
import {Resource} from '../src/resources/resource'
import {RepositoryFile} from '../src/resources/repository-file'
import {StateSchema} from '../src/terraform/schema'

test('sync', async () => {
  const yamlConfig = new config.Config('{}')
  const tfConfig = await state.State.New()

  const expectedYamlConfig = config.Config.FromPath()

  await sync(tfConfig, yamlConfig)

  yamlConfig.format()

  expect(yamlConfig.toString()).toEqual(expectedYamlConfig.toString())
})

test('sync new repository file', async () => {
  const yamlSource = {
    repositories: {
      blog: {
        files: {
          'README.md': {
            content: 'Hello, world!'
          }
        }
      }
    }
  }
  const tfSource: StateSchema = {
    values: {
      root_module: {
        resources: []
      }
    }
  }

  const loadStateMock = jest.spyOn(state, 'loadState')
  const getRepositoryFileMock = jest.spyOn(GitHub.github, 'getRepositoryFile')

  loadStateMock.mockImplementation(async () => JSON.stringify(tfSource))
  getRepositoryFileMock.mockImplementation(
    async (repository: string, path: string) => ({
      path,
      url: `https://github.com/${env.GITHUB_ORG}/${repository}/blob/main/${path}`,
      ref: 'main'
    })
  )

  const yamlConfig = new config.Config(YAML.stringify(yamlSource))
  const tfConfig = await state.State.New()

  const addResourceMock = jest.spyOn(tfConfig, 'addResource')

  addResourceMock.mockImplementation(async (id: string, resource: Resource) => {
    tfSource?.values?.root_module?.resources?.push({
      mode: 'managed',
      index: id,
      address: resource.getStateAddress(),
      type: RepositoryFile.StateType,
      values: {
        repository: (resource as RepositoryFile).repository,
        file: (resource as RepositoryFile).file,
        content: (resource as RepositoryFile).content ?? '',
        ...resource
      }
    })
  })

  const expectedYamlConfig = new config.Config(YAML.stringify(yamlSource))

  await sync(tfConfig, yamlConfig)

  yamlConfig.format()

  expect(yamlConfig.toString()).toEqual(expectedYamlConfig.toString())
})
