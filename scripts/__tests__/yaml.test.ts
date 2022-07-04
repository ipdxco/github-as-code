import 'reflect-metadata'

import * as fs from 'fs'
import * as config from '../src/yaml'
import * as YAML from 'yaml'

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

test('adds 2 new members', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const peter = new config.Resource(
    'github_membership',
    ['members', 'member'],
    YAML.parseDocument('peter').contents as YAML.Scalar
  )

  const adam = new config.Resource(
    'github_membership',
    ['members', 'member'],
    YAML.parseDocument('adam').contents as YAML.Scalar
  )

  cfg.add(peter)
  cfg.add(adam)

  expect(cfg.matchIn('github_membership', ['members', 'member']).length).toEqual(2)
  expect(cfg.getResources().length).toEqual(21)
})

test('adds 1 new file', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const file = new config.Resource(
    'github_repository_file',
    ['repositories', 'github-mgmt', 'files'],
    YAML.parseDocument('file: {}').contents as YAML.Scalar
  )

  cfg.add(file)

  expect(cfg.matchIn('github_repository_file', ['repositories', 'github-mgmt', 'files']).length).toEqual(2)
  expect(cfg.getResources().length).toEqual(20)
})

test('updates all team descriptions', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn('github_team', ['teams'])

  const teamUpdates = teams.map(team => {
    const resource = new config.Resource(team.type, team.path, team.value.clone() as YAML.Pair);
    ((resource.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'description') as YAML.Scalar).value = 'TEST'
    return resource
  })

  teams.forEach(team => {
    const description = ((team.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'description') as YAML.Scalar).value
    expect(description).not.toEqual('TEST')
  })

  teamUpdates.forEach(team => {
    cfg.update(team)
  })

  teams.forEach(team => {
    const description = ((team.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'description') as YAML.Scalar).value
    expect(description).toEqual('TEST')
  })
})

test('updates all team descriptions', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn('github_team', ['teams'])

  const teamUpdates = teams.map(team => {
    const resource = new config.Resource(team.type, team.path, team.value.clone() as YAML.Pair);
    ((resource.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'description') as YAML.Scalar).value = 'TEST'
    return resource
  })

  teams.forEach(team => {
    const description = ((team.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'description') as YAML.Scalar).value
    expect(description).not.toEqual('TEST')
  })

  teamUpdates.forEach(team => {
    cfg.update(team)
  })

  teams.forEach(team => {
    const description = ((team.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'description') as YAML.Scalar).value
    expect(description).toEqual('TEST')
  })
})

test('removes a comment on property update', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn('github_team', ['teams'])

  const resource = new config.Resource(
    'github_repository',
    ['repositories'],
    (YAML.parseDocument('github-mgmt: { allow_auto_merge: true }').contents as YAML.YAMLMap).items[0]
  );

  const existingResource = cfg.find(resource)
  const allowAutoMergePrior = (existingResource!.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'allow_auto_merge')

  expect((allowAutoMergePrior!.value as YAML.Scalar).value).toBeFalsy()

  cfg.update(resource)

  expect((allowAutoMergePrior!.value as YAML.Scalar).value).toBeTruthy()
  expect((allowAutoMergePrior!.value as YAML.Scalar).comment?.trim()).toBeUndefined()
})


test('does not upate properties when the values match', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn('github_team', ['teams'])

  const resource = new config.Resource(
    'github_repository',
    ['repositories'],
    (YAML.parseDocument('github-mgmt: { allow_auto_merge: false }').contents as YAML.YAMLMap).items[0]
  );

  const existingResource = cfg.find(resource)
  const allowAutoMergePrior = (existingResource!.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'allow_auto_merge')

  expect((allowAutoMergePrior!.value as YAML.Scalar).value).toBeFalsy()

  cfg.update(resource)

  expect((allowAutoMergePrior!.value as YAML.Scalar).value).toBeFalsy()
  expect((allowAutoMergePrior!.value as YAML.Scalar).comment?.trim()).toEqual('I will survive')
})

test('removes properties from the ignore array on updates', async () => {
  const yaml = fs.readFileSync('__tests__/resources/config.yaml').toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn('github_team', ['teams'])

  teams.forEach(team => {
    const descriptionPrior = (team!.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'description')
    expect(descriptionPrior).toBeDefined()
    cfg.update(team, ['description'])
    const descriptionPost = (team!.value.value as YAML.YAMLMap).items.find(item => (item.key as YAML.Scalar).value === 'description')
    expect(descriptionPost).toBeUndefined()
  })
})
