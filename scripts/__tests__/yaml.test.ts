import 'reflect-metadata'

import * as fs from 'fs'
import * as config from '../src/yaml'
import { YAMLError } from 'yaml'

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

test('removes all 2 admins', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const adminsPrior = cfg.getResources().filter(resource => JSON.stringify(resource.path) === JSON.stringify(['members', 'admin']))

  expect(adminsPrior.length).toEqual(2)

  adminsPrior.forEach(resource => cfg.remove(resource))

  const resourcesPost = cfg.getResources()
  const adminsPost = resourcesPost.filter(resource => JSON.stringify(resource.path) === JSON.stringify(['members', 'admin']))

  expect(resourcesPost.length).toEqual(17)
  expect(adminsPost.length).toEqual(0)
})

test('removes 3 out of 7 repository', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const repositoriesPrior = cfg.getResources().filter(resource => JSON.stringify(resource.path) === JSON.stringify(['repositories']))

  expect(repositoriesPrior.length).toEqual(7)

  repositoriesPrior.slice(0, 3).forEach(resource => cfg.remove(resource))

  const resourcesPost = cfg.getResources()
  const repositoriesPost = resourcesPost.filter(resource => JSON.stringify(resource.path) === JSON.stringify(['repositories']))

  expect(resourcesPost.length).toEqual(13)
  expect(repositoriesPost.length).toEqual(4)
})
