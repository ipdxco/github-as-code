import 'reflect-metadata'

import * as YAML from 'yaml'
import * as config from '../src/yaml'
import * as fs from 'fs'
import * as terraform from '../src/terraform'
import {camelCaseToSnakeCase} from '../src/utils'

const EmptyConfig = config.parse('{}')

test('parses terraform state', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resources = state.values.root_module.resources

  for (const resource of resources) {
    expect(resource.constructor.name).not.toEqual('Resource')
  }
})

test('finds no resources to import', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resourcesToImport = state.getResourcesToImport(
    EmptyConfig,
    terraform.ManagedResources.map(cls => camelCaseToSnakeCase(cls.name))
  )

  expect(resourcesToImport.length).toEqual(0)
})

test('finds single resource to remove', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resourcesToRemove = state.getResourcesToRemove(
    EmptyConfig,
    terraform.ManagedResources.map(cls => camelCaseToSnakeCase(cls.name))
  )

  // the resource to remove is the repository file because we're passing an empty config
  expect(resourcesToRemove.length).toEqual(1)
})

test('finds all the unmanaged resources to remove', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resourcesToRemove = state.getResourcesToRemove(EmptyConfig, [])

  expect(resourcesToRemove.length).toEqual(22)
})

test('finds no id fields on YAML resources', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const yamlResources = state.getYAMLResources()

  for (const resource of yamlResources) {
    if (YAML.isPair(resource.value)) {
      const value = resource.value.value as YAML.YAMLMap
      const keys = value.items
        .map(item => item.key as YAML.Scalar)
        .map(key => key.value)
      expect(keys).not.toContain('id')
    }
  }
})
