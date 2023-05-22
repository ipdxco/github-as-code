import 'reflect-metadata'

import {Config} from '../../src/yaml/config'
import {
  Resource,
  ResourceConstructors,
  resourceToPlain
} from '../../src/resources/resource'
import {Member, Role as MemberRole, Role} from '../../src/resources/member'
import {Repository} from '../../src/resources/repository'
import {RepositoryFile} from '../../src/resources/repository-file'
import {randomUUID} from 'crypto'
import {Team, Privacy as TeamPrivacy} from '../../src/resources/team'
import {RepositoryBranchProtectionRule} from '../../src/resources/repository-branch-protection-rule'
import {RepositoryLabel} from '../../src/resources/repository-label'

test('can retrieve resources from YAML schema', async () => {
  const config = Config.FromPath()

  const resources = []

  for (const resourceClass of ResourceConstructors) {
    const classResources = config.getResources(resourceClass)
    expect(classResources).toHaveLength(
      global.ResourceCounts[resourceClass.name]
    )
    resources.push(...classResources)
  }

  expect(resources).toHaveLength(
    Object.values(global.ResourceCounts).reduce(
      (a: number, b: number) => a + b,
      0
    )
  )
})

test('can check if YAML schema contains a resource', async () => {
  const config = Config.FromPath()

  const resources = config.getAllResources()

  for (const resource of resources) {
    expect(config.someResource(resource)).toBeTruthy()
  }
})

test('can remove members', async () => {
  const config = Config.FromPath()

  const members = config.getResources(Member)

  for (const [index, member] of members.entries()) {
    config.removeResource(member)
    expect(config.someResource(member)).toBeFalsy()
    expect(config.getResources(Member)).toHaveLength(members.length - index - 1)
  }

  expect(config.getAllResources()).toHaveLength(
    global.ResourcesCount - global.ResourceCounts[Member.name]
  )
})

test('can remove repositories, including their sub-resources', async () => {
  const config = Config.FromPath()

  const repositories = config.getResources(Repository)

  for (const [index, repository] of repositories.entries()) {
    config.removeResource(repository)
    expect(config.someResource(repository)).toBeFalsy()
    expect(config.getResources(Repository)).toHaveLength(
      repositories.length - index - 1
    )
  }

  const count =
    global.ResourcesCount -
    Object.entries(global.ResourceCounts).reduce(
      (a: number, [key, value]) =>
        key.startsWith(Repository.name) ? a + value : a,
      0
    )

  expect(config.getAllResources()).toHaveLength(count)
})

test('cannot remove labels without removing repositories', async () => {
  const config = Config.FromPath()

  const labels = config.getResources(RepositoryLabel)

  for (const [index, label] of labels.entries()) {
    config.removeResource(label)
    expect(config.someResource(label)).toBeFalsy()
    const newLabels = config.getResources(RepositoryLabel)
    expect(newLabels).toHaveLength(labels.length - index - 1)
  }

  expect(config.getAllResources()).toHaveLength(
    global.ResourcesCount - labels.length
  )
})

test('can add members', async () => {
  const config = Config.FromPath()

  const members = [
    new Member('peter', MemberRole.Admin),
    new Member('adam', MemberRole.Member)
  ]

  for (const [index, member] of members.entries()) {
    config.addResource(member)
    expect(config.someResource(member)).toBeTruthy()
    expect(config.getResources(Member)).toHaveLength(
      global.ResourceCounts[Member.name] + index + 1
    )
  }

  expect(config.getAllResources()).toHaveLength(
    global.ResourcesCount + members.length
  )
})

test('can add files, including their parent resources', async () => {
  const config = Config.FromPath()

  const randomName = randomUUID()

  const repositories = [
    new Repository(randomName),
    config.getResources(Repository)[0]
  ]

  const files: RepositoryFile[] = []

  for (const repository of repositories) {
    files.push(new RepositoryFile(repository.name, randomName))
  }

  const count =
    global.ResourcesCount +
    files.filter(f => !config.someResource(f)).length +
    repositories.filter(r => !config.someResource(r)).length

  for (const [index, file] of files.entries()) {
    config.addResource(file)
    expect(config.someResource(file)).toBeTruthy()
    expect(config.getResources(RepositoryFile)).toHaveLength(
      global.ResourceCounts[RepositoryFile.name] + index + 1
    )
  }

  expect(config.getAllResources()).toHaveLength(count)
})

test('can update teams', async () => {
  const config = Config.FromPath()

  const teams = config
    .getResources(Team)
    .filter(t => t.privacy !== TeamPrivacy.PRIVATE)

  expect(teams).not.toHaveLength(0)

  for (const team of teams) {
    team.privacy = TeamPrivacy.PRIVATE
    config.addResource(team)
  }

  const updatedTeams = config.getResources(Team)

  for (const team of updatedTeams) {
    expect(team.privacy).toBe(TeamPrivacy.PRIVATE)
  }
})

test('clears comments on member removal', async () => {
  const config = Config.FromPath()

  const comment = 'This is a comment'

  const member = config.getResources(Member)[0]

  ;(config.document.getIn(['members', member.role]) as any).items[0].comment =
    comment

  config.removeResource(member)

  const updatedMembers = config.document.getIn(['members', member.role]) as any
  for (const item of updatedMembers.items) {
    expect(item.comment).not.toEqual(comment)
  }
})

test('clears comments on repository property updates', async () => {
  const config = Config.FromPath()

  const comment = 'This is a comment'
  const property = 'description'
  const description = 'This is a description'

  const repository = config.getResources(Repository)[0]

  expect(repository[property]).toBeDefined()
  expect(repository[property]).not.toEqual(description)

  const repositories = config.document.getIn([
    'repositories',
    repository.name
  ]) as any

  repositories.items.find((i: any) => i.key.value === property)!.value.comment =
    comment

  repository[property] = description

  config.addResource(repository)

  const updatedRepositories = config.document.getIn([
    'repositories',
    repository.name
  ]) as any
  expect(
    updatedRepositories.items.find((i: any) => i.key.value === property)!.value
      .comment
  ).toBeUndefined()
  expect(config.getResources(Repository)[0][property]).toEqual(description)
})

test('does not clear comments on same member addition', async () => {
  const config = Config.FromPath()

  const comment = 'This is a comment'

  const member = config.getResources(Member)[0]

  const members = config.document.getIn(['members', member.role]) as any
  members.items[0].comment = comment

  config.addResource(member)

  const updatedMembers = config.document.getIn(['members', member.role]) as any

  expect(
    updatedMembers.items.some((i: any) => i.comment === comment)
  ).toBeTruthy()
})

test('does not clear comments on repository property updates to the same value', async () => {
  const config = Config.FromPath()

  const comment = 'This is a comment'
  const property = 'description'

  const repository = config.getResources(Repository)[0]

  expect(repository[property]).toBeDefined()

  const repositories = config.document.getIn([
    'repositories',
    repository.name
  ]) as any
  repositories.items.find((i: any) => i.key.value === property)!.value.comment =
    comment

  config.addResource(repository)

  const updatedRepositories = config.document.getIn([
    'repositories',
    repository.name
  ]) as any
  expect(
    updatedRepositories.items.find((i: any) => i.key.value === property)!.value
      .comment
  ).toEqual(comment)
})

test('can add a repository followed by a repository branch protection rule', async () => {
  const config = new Config('{}')

  config.addResource(new Repository('test'))
  config.addResource(new RepositoryBranchProtectionRule('test', 'main'))

  expect(config.getResources(RepositoryBranchProtectionRule)).toHaveLength(1)
  expect(config.getResources(Repository)).toHaveLength(1)
})

test('can add a repository branch protection rule followed by a repository', async () => {
  const config = new Config('{}')

  config.addResource(new RepositoryBranchProtectionRule('test', 'main'))
  config.addResource(new Repository('test'))

  expect(config.getResources(RepositoryBranchProtectionRule)).toHaveLength(1)
  expect(config.getResources(Repository)).toHaveLength(1)
})

test('does not remove properties when adding a team', async () => {
  const config = Config.FromPath()

  const team = config.getResources(Team)[0]
  const definedValues = Object.values(resourceToPlain(team) as any).filter(
    v => v !== undefined
  )
  expect(definedValues).not.toHaveLength(0)
  config.addResource(new Team(team.name), false)

  const updatedTeam = config.getResources(Team)[0]
  const updatedDefinedValues = Object.values(
    resourceToPlain(updatedTeam) as any
  ).filter(v => v !== undefined)
  expect(updatedDefinedValues).not.toHaveLength(0)
})

test('does remove undefined properties when adding a team with delete flag set', async () => {
  const config = Config.FromPath()

  const team = config.getResources(Team)[0]
  const definedValues = Object.values(resourceToPlain(team) as any).filter(
    v => v !== undefined
  )
  expect(definedValues).not.toHaveLength(0)
  config.addResource(new Team(team.name), true)

  const updatedTeam = config.getResources(Team)[0]
  const updatedDefinedValues = Object.values(
    resourceToPlain(updatedTeam) as any
  ).filter(v => v !== undefined)
  expect(updatedDefinedValues).toHaveLength(0)
})

test('formats config deterministically', async () => {
  const config = new Config(`
repositories:
  b: {}
  a:
    description: ''
    pages:
      source: null
  C:
    description: 'c'
teams: {}
members:
  member:
    - Peter
    - undefined
    - paul
  admin:
    - John
    - adam
  `)

  const undefinedMember = config
    .getResources(Member)
    .find(m => m.username === 'undefined')!
  config.removeResource(undefinedMember)
  config.format()
  const formatted = config.toString().trim()

  const expected = `
members:
  admin:
    - adam
    - John
  member:
    - paul
    - Peter
repositories:
  a:
    {}
  b:
    {}
  C:
    description: "c"
  `.trim()

  expect(formatted).toEqual(expected)
})

test('can add and remove resources through sync', async () => {
  const config = new Config('{}')
  let desiredResources: Resource[] = []
  let resources = config.getAllResources()

  config.sync(desiredResources)
  expect(resources).toHaveLength(desiredResources.length)

  desiredResources.push(new Repository('test'))
  desiredResources.push(new Repository('test2'))
  desiredResources.push(new Repository('test3'))
  desiredResources.push(new Repository('test4'))

  config.sync(desiredResources)
  resources = config.getAllResources()
  expect(resources).toHaveLength(desiredResources.length)

  desiredResources.pop()
  desiredResources.pop()

  config.sync(desiredResources)
  resources = config.getAllResources()
  expect(resources).toHaveLength(desiredResources.length)
})
