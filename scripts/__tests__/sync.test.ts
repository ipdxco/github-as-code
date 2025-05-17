import 'reflect-metadata'

import * as YAML from 'yaml'

import {Config} from '../src/yaml/config.js'
import {State} from '../src/terraform/state.js'
import {sync} from '../src/sync.js'
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

    const resources = [
      {
        mode: 'managed',
        index: 'blog:README.md',
        address: 'github_repository_file.this["blog/readme.md"]',
        type: RepositoryFile.StateType,
        values: {
          repository: 'blog',
          file: 'README.md',
          content: 'Hello, world!'
        }
      }
    ]

    tfConfig.addResourceAt = async (_id: string, address: string) => {
      const resource = resources.find(r => r.address === address)
      if (resource !== undefined) {
        tfSource?.values?.root_module?.resources?.push(resource)
      }
    }

    const expectedYamlConfig = new Config(YAML.stringify(yamlSource))

    await sync(tfConfig, yamlConfig)

    yamlConfig.format()

    assert.equal(yamlConfig.toString(), expectedYamlConfig.toString())
  })
})
