import 'reflect-metadata'

import * as YAML from 'yaml'
import * as config from '../src/yaml'
import * as fs from 'fs'

test('parses yaml config', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  config.parse(yaml)
})

test('finds all 19 resources', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)
  const resources = cfg.getResources()
  expect(resources.length).toEqual(19)

  for (const resource of resources) {
    expect(cfg.contains(resource)).toBeTruthy()
  }
})

test('removes all 2 admins', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const adminsPrior = cfg
    .getResources()
    .filter(
      resource =>
        JSON.stringify(resource.path) === JSON.stringify(['members', 'admin'])
    )

  expect(adminsPrior.length).toEqual(2)

  for (const admin of adminsPrior) {
    cfg.remove(admin)
  }

  const resourcesPost = cfg.getResources()
  const adminsPost = resourcesPost.filter(
    resource =>
      JSON.stringify(resource.path) === JSON.stringify(['members', 'admin'])
  )

  expect(resourcesPost.length).toEqual(17)
  expect(adminsPost.length).toEqual(0)
})

test('removes 3 out of 7 repository', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const repositoriesPrior = cfg
    .getResources()
    .filter(
      resource =>
        JSON.stringify(resource.path) === JSON.stringify(['repositories'])
    )

  expect(repositoriesPrior.length).toEqual(7)

  for (const repository of repositoriesPrior.slice(0, 3)) {
    cfg.remove(repository)
  }

  const resourcesPost = cfg.getResources()
  const repositoriesPost = resourcesPost.filter(
    resource =>
      JSON.stringify(resource.path) === JSON.stringify(['repositories'])
  )

  expect(resourcesPost.length).toEqual(13)
  expect(repositoriesPost.length).toEqual(4)
})

test('adds 2 new members', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

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

  expect(
    cfg.matchIn('github_membership', ['members', 'member']).length
  ).toEqual(2)
  expect(cfg.getResources().length).toEqual(21)
})

test('adds 1 new file', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const file = new config.Resource(
    'github_repository_file',
    ['repositories', 'github-mgmt', 'files'],
    (YAML.parseDocument('file: {}').contents as YAML.YAMLMap).items[0]
  )

  cfg.add(file)

  expect(
    cfg.matchIn('github_repository_file', [
      'repositories',
      'github-mgmt',
      'files'
    ]).length
  ).toEqual(2)
  expect(cfg.getResources().length).toEqual(20)
})

test('updates all team privacy settings', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn('github_team', ['teams'])

  const teamUpdates = teams.map(team => {
    const resource = new config.Resource(
      team.type,
      team.path,
      team.value.clone() as YAML.Pair
    )
    ;(
      (resource.value.value as YAML.YAMLMap).items.find(
        item => (item.key as YAML.Scalar).value === 'privacy'
      ) as YAML.Scalar
    ).value = 'secret'
    return resource
  })

  for (const team of teams) {
    const description = (
      (team.value.value as YAML.YAMLMap).items.find(
        item => (item.key as YAML.Scalar).value === 'privacy'
      ) as YAML.Scalar
    ).value
    expect(description).not.toEqual('secret')
  }

  for (const team of teamUpdates) {
    cfg.update(team)
  }

  for (const team of teams) {
    const description = (
      (team.value.value as YAML.YAMLMap).items.find(
        item => (item.key as YAML.Scalar).value === 'privacy'
      ) as YAML.Scalar
    ).value
    expect(description).toEqual('secret')
  }
})

test('removes a comment on property update', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const resource = new config.Resource(
    'github_repository',
    ['repositories'],
    (
      YAML.parseDocument('github-mgmt: { allow_auto_merge: true }')
        .contents as YAML.YAMLMap
    ).items[0]
  )

  const existingResource = cfg.find(resource)
  expect(existingResource).toBeDefined()
  const allowAutoMerge = (
    (existingResource as config.Resource).value.value as YAML.YAMLMap
  ).items.find(item => (item.key as YAML.Scalar).value === 'allow_auto_merge')
  expect(allowAutoMerge).toBeDefined()
  ;((allowAutoMerge as YAML.Pair).value as YAML.Scalar).comment =
    'I will survive'

  expect(((allowAutoMerge as YAML.Pair).value as YAML.Scalar).value).toBeFalsy()

  cfg.update(resource)

  expect(
    ((allowAutoMerge as YAML.Pair).value as YAML.Scalar).value
  ).toBeTruthy()
  expect(
    ((allowAutoMerge as YAML.Pair).value as YAML.Scalar).comment
  ).toBeUndefined()
})

test('does not upate properties when the values match', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const resource = new config.Resource(
    'github_repository',
    ['repositories'],
    (
      YAML.parseDocument('github-mgmt: { allow_auto_merge: false }')
        .contents as YAML.YAMLMap
    ).items[0]
  )

  const existingResource = cfg.find(resource)
  expect(existingResource).toBeDefined()
  const allowAutoMerge = (
    (existingResource as config.Resource).value.value as YAML.YAMLMap
  ).items.find(item => (item.key as YAML.Scalar).value === 'allow_auto_merge')
  expect(allowAutoMerge).toBeDefined()
  ;((allowAutoMerge as YAML.Pair).value as YAML.Scalar).comment =
    'I will survive'

  expect(((allowAutoMerge as YAML.Pair).value as YAML.Scalar).value).toBeFalsy()

  cfg.update(resource)

  expect(((allowAutoMerge as YAML.Pair).value as YAML.Scalar).value).toBeFalsy()
  expect(((allowAutoMerge as YAML.Pair).value as YAML.Scalar).comment).toEqual(
    'I will survive'
  )
})

test('removes properties from the ignore array on updates', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn('github_team', ['teams'])

  for (const team of teams) {
    const descriptionPrior = (team.value.value as YAML.YAMLMap).items.find(
      item => (item.key as YAML.Scalar).value === 'privacy'
    )
    expect(descriptionPrior).toBeDefined()
    cfg.update(team, ['privacy'])
    const descriptionPost = (team.value.value as YAML.YAMLMap).items.find(
      item => (item.key as YAML.Scalar).value === 'privacy'
    )
    expect(descriptionPost).toBeUndefined()
  }
})
