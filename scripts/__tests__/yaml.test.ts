import 'reflect-metadata'

import * as YAML from 'yaml'
import * as config from '../src/yaml'
import * as fs from 'fs'
import * as schema from '../src/schema'
import exp from 'constants'

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
  const json = cfg.getJSON()
  const members = json.get(schema.Member)
  const teams = json.get(schema.Team)
  const teamMembers = json.get(schema.TeamMember)
  const repositories = json.get(schema.Repository)
  const repositoryCollaborators = json.get(schema.RepositoryCollaborator)
  const repositoryTeams = json.get(schema.RepositoryTeam)
  const branchProtections = json.get(schema.BranchProtection)
  const files = json.get(schema.File)
  const resources = json.getAll()

  expect(members.length).toEqual(2)
  expect(teams.length).toEqual(1)
  expect(teamMembers.length).toEqual(2)
  expect(repositories.length).toEqual(7)
  expect(repositoryCollaborators.length).toEqual(1)
  expect(repositoryTeams.length).toEqual(7)
  expect(branchProtections.length).toEqual(1)
  expect(files.length).toEqual(1)
  expect(resources.length).toEqual(22)

  for (const resource of resources) {
    expect(json.has(resource)).toBeTruthy()
  }
})

test('removes all 2 admins', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)
  let json = cfg.getJSON()

  const adminsPrior = json
    .get(schema.Member)
    .filter(
      resource =>
        JSON.stringify(resource.getPath()) === JSON.stringify(['members', 'admin'])
    )

  expect(adminsPrior.length).toEqual(2)

  for (const admin of adminsPrior) {
    cfg.remove(admin)
  }

  json = cfg.getJSON()

  const resourcesPost = json.getAll()
  const adminsPost = json.get(schema.Member).filter(
    resource =>
      JSON.stringify(resource.getPath()) === JSON.stringify(['members', 'admin'])
  )

  expect(resourcesPost.length).toEqual(20)
  expect(adminsPost.length).toEqual(0)
})

test('removes 3 out of 7 repository', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)
  let json = cfg.getJSON()

  const repositoriesPrior = json
    .get(schema.Repository)

  expect(repositoriesPrior.length).toEqual(7)

  for (const repository of repositoriesPrior.slice(0, 3)) {
    cfg.remove(repository)
  }

  json = cfg.getJSON()

  const resourcesPost = json.getAll()
  const repositoriesPost = json.get(schema.Repository)

  expect(resourcesPost.length).toEqual(13)
  expect(repositoriesPost.length).toEqual(4)
})

test('adds 2 new members', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const peter = schema.plainToClass(schema.Member, { username: 'peter', role: 'member' })
  const adam = schema.plainToClass(schema.Member, { username: 'adam', role: 'member' })

  cfg.add(peter)
  cfg.add(adam)

  const json = cfg.getJSON()

  expect(
    json.get(schema.Member).filter(m => m.role == 'member').length
  ).toEqual(2)
  expect(json.getAll().length).toEqual(24)
})

test('adds 1 new file', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const file = schema.plainToClass(schema.File, { repository: 'github-mgmt', file: 'file' })

  cfg.add(file)

  const json = cfg.getJSON()

  expect(
    json.get(schema.File).length
  ).toEqual(2)
  expect(json.getAll().length).toEqual(23)
})

test('updates all team privacy settings', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  let json = cfg.getJSON()

  const teams = json.get(schema.Team)

  const teamUpdates = teams.map(team => {
    const teamUpdate = schema.plainToClass(schema.Team, {...team})
    teamUpdate.privacy = 'secret'
    return teamUpdate
  })

  for (const team of teams) {
    expect(team.privacy).not.toEqual('secret')
  }

  for (const team of teamUpdates) {
    cfg.add(team)
  }

  json = cfg.getJSON()

  const updatedTeams = json.get(schema.Team)

  for (const team of updatedTeams) {
    expect(team.privacy).toEqual('secret')
  }
})

test('removes a comment on property update', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const resource = schema.plainToClass(schema.Repository, { name: 'github-mgmt', allow_auto_merge: true })

  const repository = cfg.document.getIn(['repositories', 'github-mgmt']) as YAML.YAMLMap<YAML.Scalar<string>, unknown>
  const allowAutoMerge = repository.items.find(item => item.key.value == 'allow_auto_merge') as YAML.Pair<YAML.Scalar<string>, YAML.Scalar<boolean>>
  allowAutoMerge.value!.comment = 'I will survive... NOT!'
  expect(allowAutoMerge.value!.value).toBeFalsy()

  cfg.add(resource)

  expect(allowAutoMerge.value!.value).toBeTruthy()
  expect(allowAutoMerge.value!.comment).toBeUndefined()
})

test('does not upate properties when the values match', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)

  const resource = schema.plainToClass(schema.Repository, { name: 'github-mgmt', allow_auto_merge: false })

  const repository = cfg.document.getIn(['repositories', 'github-mgmt']) as YAML.YAMLMap<YAML.Scalar<string>, unknown>
  const allowAutoMerge = repository.items.find(item => item.key.value == 'allow_auto_merge') as YAML.Pair<YAML.Scalar<string>, YAML.Scalar<boolean>>
  allowAutoMerge.value!.comment = 'I will survive'
  expect(allowAutoMerge.value!.value).toBeFalsy()

  cfg.add(resource)

  expect(allowAutoMerge.value!.value).toBeFalsy()
  expect(allowAutoMerge.value!.comment).toEqual('I will survive')
})

test('removes properties from the ignore array on fmt', async () => {
  const yaml = fs
    .readFileSync('__tests__/resources/github/default.yml')
    .toString()

  const cfg = config.parse(yaml)
  let json = cfg.getJSON()

  const teams = json.get(schema.Team)

  for (const team of teams) {
    expect(team.privacy).toBeDefined()
  }

  cfg.fmt(['github_team'], {github_team: ['privacy']})

  json = cfg.getJSON()

  const updatedTeams = json.get(schema.Team)

  for (const team of updatedTeams) {
    expect(team.privacy).toBeUndefined()
  }
})
