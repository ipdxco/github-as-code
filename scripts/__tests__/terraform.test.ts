import 'reflect-metadata'

import * as YAML from 'yaml'
import * as fs from 'fs'
import * as terraform from '../src/terraform'
import {camelCaseToSnakeCase} from '../src/utils'

test('parses terraform state', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resources = state.values.root_module.resources.filter(resource => {
    return resource.type !== 'null_resource'
  })

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
    terraform.ManagedResources.map(cls => camelCaseToSnakeCase(cls.name))
  )

  expect(resourcesToImport.length).toEqual(0)
})

test('finds no resources to remove', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resourcesToRemove = state.getResourcesToRemove(
    terraform.ManagedResources.map(cls => camelCaseToSnakeCase(cls.name))
  )

  expect(resourcesToRemove.length).toEqual(0)
})

test('finds all the unmanaged resources to remove', async () => {
  const json = fs
    .readFileSync('__tests__/resources/terraform/terraform.tfstate')
    .toString()
  const state = terraform.parse(json)

  const resourcesToRemove = state.getResourcesToRemove([])

  expect(resourcesToRemove.length).toEqual(19)
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
