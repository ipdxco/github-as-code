import 'reflect-metadata'

import * as YAML from 'yaml'

import {Config} from '../src/yaml/config.js'
import {State} from '../src/terraform/state.js'
import {sync} from '../src/sync.js'
import {Resource} from '../src/resources/resource.js'
import {RepositoryFile} from '../src/resources/repository-file.js'
import {StateSchema} from '../src/terraform/schema.js'
import {toggleArchivedRepos} from '../src/actions/shared/toggle-archived-repos.js'
import {before, describe, it, mock} from 'node:test'
import assert from 'node:assert'
import {mockGitHub} from './github.js'

describe('sync', () => {
  before(() => {
    mockGitHub()
  })

  it('sync', async () => {
    const yamlConfig = new Config('{}')
    const tfConfig = await State.New()

    const expectedYamlConfig = Config.FromPath()

    await sync(tfConfig, yamlConfig)
    await toggleArchivedRepos(tfConfig, yamlConfig)

    yamlConfig.format()

    assert.equal(yamlConfig.toString(), expectedYamlConfig.toString())
  })

  it('sync new repository file', async () => {
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

    const yamlConfig = new Config(YAML.stringify(yamlSource))
    const tfConfig = new State(JSON.stringify(tfSource))

    mock.module('../src/terraform/state.js', {
      namedExports: {
        loadState: async () => JSON.stringify(tfSource)
      }
    })

    tfConfig.addResource = async (id: string, resource: Resource) => {
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
    }

    const expectedYamlConfig = new Config(YAML.stringify(yamlSource))

    await sync(tfConfig, yamlConfig)

    yamlConfig.format()

    assert.equal(yamlConfig.toString(), expectedYamlConfig.toString())
  })
})
