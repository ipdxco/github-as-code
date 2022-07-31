import 'reflect-metadata'

import * as YAML from 'yaml'
import * as config from '../src/yaml'
import * as fs from 'fs'
import * as schema from '../src/schema'

test('parses yaml config', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  config.parse(yaml)
})

test('finds all 22 resources', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)
  const resources = cfg.getAllResources()

  expect(resources.length).toEqual(22)

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
    .getResources(schema.Member)
    .filter(
      resource =>
        JSON.stringify(resource.path) === JSON.stringify(['members', 'admin'])
    )

  expect(adminsPrior.length).toEqual(2)

  for (const admin of adminsPrior) {
    cfg.remove(admin)
  }

  const resourcesPost = cfg.getAllResources()
  const adminsPost = cfg.getResources(schema.Member).filter(
    resource =>
      JSON.stringify(resource.path) === JSON.stringify(['members', 'admin'])
  )

  expect(resourcesPost.length).toEqual(20)
  expect(adminsPost.length).toEqual(0)
})

test('removes 3 out of 7 repository', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const repositoriesPrior = cfg
    .getResources(schema.Repository)

  expect(repositoriesPrior.length).toEqual(7)

  for (const repository of repositoriesPrior.slice(0, 3)) {
    cfg.remove(repository)
  }

  const resourcesPost = cfg.getAllResources()
  const repositoriesPost = cfg.getResources(schema.Repository)

  expect(resourcesPost.length).toEqual(13)
  expect(repositoriesPost.length).toEqual(4)
})

test('adds 2 new members', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const peter = new config.Resource(
    ['members', 'member'],
    schema.plainToClass(schema.Member, 'peter')
  )

  const adam = new config.Resource(
    ['members', 'member'],
    schema.plainToClass(schema.Member, 'adam')
  )

  cfg.add(peter)
  cfg.add(adam)

  expect(
    cfg.matchIn(schema.Member, ['members', 'member']).length
  ).toEqual(2)
  expect(cfg.getAllResources().length).toEqual(24)
})

test('adds 1 new file', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const file = new config.Resource(
    ['repositories', 'github-mgmt', 'files', 'file'],
    schema.plainToClass(schema.File, {})
  )

  cfg.add(file)

  expect(
    cfg.matchIn(schema.File, [
      'repositories',
      'github-mgmt',
      'files',
      '*'
    ]).length
  ).toEqual(2)
  expect(cfg.getAllResources().length).toEqual(23)
})

test('updates all team privacy settings', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn(schema.Team, ['teams', '*'])

  const teamUpdates = teams.map(team => {
    const teamUpdate = schema.plainToClass(schema.Team, {...team.value})
    teamUpdate.privacy = 'secret'
    const resource = new config.Resource(
      team.path,
      teamUpdate
    );
    return resource
  })

  for (const team of teams) {
    expect((team.value as schema.Team).privacy).not.toEqual('secret')
  }

  for (const team of teamUpdates) {
    cfg.update(team)
  }

  const updatedTeams = cfg.getResources(schema.Team)

  for (const team of updatedTeams) {
    expect((team.value as schema.Team).privacy).toEqual('secret')
  }
})

test('removes a comment on property update', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const resource = new config.Resource(
    ['repositories', 'github-mgmt'],
    schema.plainToClass(schema.Repository, { allow_auto_merge: true })
  )

  const repository = cfg.document.getIn(['repositories', 'github-mgmt']) as YAML.YAMLMap<YAML.Scalar<string>, unknown>
  const allowAutoMerge = repository.items.find(item => item.key.value == 'allow_auto_merge') as YAML.Pair<YAML.Scalar<string>, YAML.Scalar<boolean>>
  allowAutoMerge.value!.comment = 'I will survive... NOT!'
  expect(allowAutoMerge.value!.value).toBeFalsy()

  cfg.update(resource)

  expect(allowAutoMerge.value!.value).toBeTruthy()
  expect(allowAutoMerge.value!.comment).toBeUndefined()
})

test('does not upate properties when the values match', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const resource = new config.Resource(
    ['repositories', 'github-mgmt'],
    schema.plainToClass(schema.Repository, { allow_auto_merge: false })
  )

  const repository = cfg.document.getIn(['repositories', 'github-mgmt']) as YAML.YAMLMap<YAML.Scalar<string>, unknown>
  const allowAutoMerge = repository.items.find(item => item.key.value == 'allow_auto_merge') as YAML.Pair<YAML.Scalar<string>, YAML.Scalar<boolean>>
  allowAutoMerge.value!.comment = 'I will survive'
  expect(allowAutoMerge.value!.value).toBeFalsy()

  cfg.update(resource)

  expect(allowAutoMerge.value!.value).toBeFalsy()
  expect(allowAutoMerge.value!.comment).toEqual('I will survive')
})

test('removes properties from the ignore array on fmt', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const teams = cfg.matchIn(schema.Team, ['teams', '*'])

  for (const team of teams) {
    expect((team.value as schema.Team).privacy).toBeDefined()
  }

  cfg.fmt(['github_team'], {github_team: ['privacy']})

  const updatedTeams = cfg.matchIn(schema.Team, ['teams', '*'])

  for (const team of updatedTeams) {
    expect((team.value as schema.Team).privacy).toBeUndefined()
  }
})

test('add repository followed by a branch protection rule', async () => {
    const cfg = config.parse("{}")

    const repository = new config.Resource(
      ["repositories", "github-mgmt"],
      schema.plainToClass(schema.Repository, {archived: false})
    )

    const branchProtection = new config.Resource(
      ["repositories", "github-mgmt", "branch_protection", "master"],
      schema.plainToClass(schema.BranchProtection, {allows_deletions: false})
    )
})
