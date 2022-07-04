import 'reflect-metadata'

import * as fs from 'fs'
import * as terraform from '../src/terraform'
import * as YAML from 'yaml'

test('parses terraform state', async () => {
  const json = fs.readFileSync('__tests__/resources/state.json').toString()
  const state = terraform.parse(json)

  state.values.root_module.resources.filter(resource => {
    return resource.type != 'null_resource'
  }).forEach(resource => {
    expect(resource.constructor.name).not.toEqual('Resource')
  })
})

test('finds no resources to import', async () => {
  const json = fs.readFileSync('__tests__/resources/state.json').toString()
  const state = terraform.parse(json)

  const resourcesToImport = state.getResourcesToImport()

  expect(resourcesToImport.length).toEqual(0)
})


test('finds no resources to remove', async () => {
  const json = fs.readFileSync('__tests__/resources/state.json').toString()
  const state = terraform.parse(json)

  const resourcesToRemove = state.getResourcesToRemove()

  expect(resourcesToRemove.length).toEqual(0)
})

test('finds no id fields on YAML resources', async () => {
  const json = fs.readFileSync('__tests__/resources/state.json').toString()
  const state = terraform.parse(json)

  const yamlResources = state.getYAMLResources()

  yamlResources.forEach(resource => {
    if (YAML.isPair(resource.value)) {
      const value = resource.value.value as YAML.YAMLMap
      const keys = value.items.map(item => item.key as YAML.Scalar).map(key => key.value)
      expect(keys).not.toContain('id')
    }
  })
})
