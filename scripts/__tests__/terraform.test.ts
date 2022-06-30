import 'reflect-metadata'

import * as fs from 'fs'
import * as terraform from '../src/terraform'

test('parses terraform state', async () => {
  const json = fs.readFileSync('__tests__/resources/state.json').toString()
  const state = terraform.parse(json)

  state.values.root_module.resources.forEach(resource => {
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
