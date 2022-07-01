import 'reflect-metadata'

import * as fs from 'fs'
import * as config from '../src/yaml'

test('parses yaml config', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  config.parse(yaml)
})

test('finds all 19 resources', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)
  const resources = cfg.getResources()
  expect(resources.length).toEqual(19)

  resources.forEach(resource => {
    expect(cfg.contains(resource)).toBeTruthy()
  })
})
