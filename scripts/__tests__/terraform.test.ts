import 'reflect-metadata'

import * as YAML from 'yaml'
import * as config from '../src/yaml'
import * as fs from 'fs'
import * as terraform from '../src/terraform'
import {GitHub} from '../src/github'
import {camelCaseToSnakeCase} from '../src/utils'

const EmptyConfig = config.parse('{}')

GitHub.github = {
  listMembers: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositories: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeams: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositoryCollaborators: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositoryBranchProtectionRules: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeamRepositories: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeamMembers: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  getRepositoryFile: async (_repository: string, _path: string) => {
    return undefined
  }
} as GitHub

test('parses terraform state', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resources = state.values.root_module.resources.map(
    resource => resource.constructor.name
  )

  for (const cls of terraform.ManagedResources) {
    expect(resources).toContain(cls.name)
  }
})

test('finds no resources to import', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resourcesToImport = await state.getResourcesToImport(
    EmptyConfig,
    terraform.ManagedResources.map(cls => camelCaseToSnakeCase(cls.name))
  )

  expect(resourcesToImport.length).toEqual(0)
})

test('finds all the resources to remove', async () => {
  // becaues github returns empty responses
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resourcesToRemove = await state.getResourcesToRemove(
    EmptyConfig,
    terraform.ManagedResources.map(cls => camelCaseToSnakeCase(cls.name))
  )

  expect(resourcesToRemove.length).toEqual(22)
})

test('finds all the unmanaged resources to remove', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resourcesToRemove = await state.getResourcesToRemove(EmptyConfig, [])

  expect(resourcesToRemove.length).toEqual(22)
})

test('finds no id fields on YAML resources', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const yamlResources = await state.getYAMLResources()

  for (const resource of yamlResources) {
    expect(Object.keys(resource)).not.toContain('id')
  }
})
