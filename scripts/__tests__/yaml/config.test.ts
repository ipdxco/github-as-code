import 'reflect-metadata'

import * as YAML from 'yaml'
import {Config} from '../../src/yaml/config.js'
import {
  Resource,
  ResourceConstructors,
  resourceToPlain
} from '../../src/resources/resource.js'
import {Member, Role as MemberRole} from '../../src/resources/member.js'
import {Repository} from '../../src/resources/repository.js'
import {RepositoryFile} from '../../src/resources/repository-file.js'
import {randomUUID} from 'crypto'
import {Team, Privacy as TeamPrivacy} from '../../src/resources/team.js'
import {RepositoryBranchProtectionRule} from '../../src/resources/repository-branch-protection-rule.js'
import {Collection} from 'yaml/dist/nodes/Collection.js'
import assert from 'node:assert'
import {toggleArchivedRepos} from '../../src/actions/shared/toggle-archived-repos.js'
import {State} from '../../src/terraform/state.js'
import {describe, it} from 'node:test'
import {
  ConfigResourceCounts,
  ConfigResourcesCount
} from '../resources/counts.js'

describe('config', () => {
  it('can retrieve resources from YAML schema', async () => {
    const config = Config.FromPath()

    const resources = []

    for (const resourceClass of ResourceConstructors) {
      const classResources = config.getResources(resourceClass)
      assert.equal(
        classResources.length,
        ConfigResourceCounts[resourceClass.name]
      )
      resources.push(...classResources)
    }

    assert.equal(
      resources.length,
      Object.values(ConfigResourceCounts).reduce(
        (a: number, b: number) => a + b,
        0
      )
    )
  })

  it('can check if YAML schema contains a resource', async () => {
    const config = Config.FromPath()

    const resources = config.getAllResources()

    for (const resource of resources) {
      assert.equal(config.someResource(resource), true)
    }
  })

  it('can remove members', async () => {
    const config = Config.FromPath()

    const members = config.getResources(Member)

    for (const [index, member] of members.entries()) {
      config.removeResource(member)
      assert.equal(config.someResource(member), false)
      assert.equal(
        config.getResources(Member).length,
        members.length - index - 1
      )
    }

    assert.equal(
      config.getAllResources().length,
      ConfigResourcesCount - ConfigResourceCounts[Member.name]
    )
  })

  it('can remove repositories, including their sub-resources', async () => {
    const config = Config.FromPath()

    const repositories = config.getResources(Repository)

    for (const [index, repository] of repositories.entries()) {
      config.removeResource(repository)
      assert.equal(config.someResource(repository), false)
      assert.equal(
        config.getResources(Repository).length,
        repositories.length - index - 1
      )
    }

    const count =
      ConfigResourcesCount -
      Object.entries(ConfigResourceCounts).reduce(
        (a: number, [key, value]) =>
          key.startsWith(Repository.name) ? a + value : a,
        0
      )

    assert.equal(config.getAllResources().length, count)
  })

  it('can add members', async () => {
    const config = Config.FromPath()

    const members = [
      new Member('peter', MemberRole.Admin),
      new Member('adam', MemberRole.Member)
    ]

    for (const [index, member] of members.entries()) {
      config.addResource(member)
      assert.notEqual(config.someResource(member), false)
      assert.equal(
        config.getResources(Member).length,
        ConfigResourceCounts[Member.name] + index + 1
      )
    }

    assert.equal(
      config.getAllResources().length,
      ConfigResourcesCount + members.length
    )
  })

  it('can add files, including their parent resources', async () => {
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
      ConfigResourcesCount +
      files.filter(f => !config.someResource(f)).length +
      repositories.filter(r => !config.someResource(r)).length

    for (const [index, file] of files.entries()) {
      config.addResource(file)
      assert.equal(config.someResource(file), true)
      assert.equal(
        config.getResources(RepositoryFile).length,
        ConfigResourceCounts[RepositoryFile.name] + index + 1
      )
    }

    assert.equal(config.getAllResources().length, count)
  })

  it('can update teams', async () => {
    const config = Config.FromPath()

    const teams = config
      .getResources(Team)
      .filter(t => t.privacy !== TeamPrivacy.PRIVATE)

    assert.notEqual(teams.length, 0)

    for (const team of teams) {
      team.privacy = TeamPrivacy.PRIVATE
      config.addResource(team)
    }

    const updatedTeams = config.getResources(Team)

    for (const team of updatedTeams) {
      assert.equal(team.privacy, TeamPrivacy.PRIVATE)
    }
  })

  it('clears comments on member removal', async () => {
    const config = Config.FromPath()

    const comment = 'This is a comment'

    const member = config.getResources(Member)[0]

    const nodes = config.document.getIn(['members', member.role]) as Collection
    const node = nodes.items[0] as {comment?: string}
    node.comment = comment

    config.removeResource(member)

    const updatedMembers = config.document.getIn([
      'members',
      member.role
    ]) as Collection
    for (const item of updatedMembers.items as {comment?: string}[]) {
      assert.notEqual(item.comment, comment)
    }
  })

  it('clears comments on repository property updates', async () => {
    const config = Config.FromPath()

    const comment = 'This is a comment'
    const property = 'description'
    const description = 'This is a description'

    const repository = config.getResources(Repository)[0]

    assert.notEqual(repository[property], undefined)
    assert.notEqual(repository[property], description)

    const repositories = config.document.getIn([
      'repositories',
      repository.name
    ]) as Collection
    const nodes = repositories.items as YAML.Pair<
      YAML.Scalar,
      {comment?: string}
    >[]
    const node = nodes.find(i => i.key.value === property)
    assert(node !== undefined)
    assert(node.value !== null)
    node.value.comment = comment

    repository[property] = description

    config.addResource(repository)

    const updatedRepositories = config.document.getIn([
      'repositories',
      repository.name
    ]) as Collection
    const updatedNodes = updatedRepositories.items as YAML.Pair<
      YAML.Scalar,
      {comment?: string}
    >[]
    const updatedNode = updatedNodes.find(i => i.key.value === property)
    assert(updatedNode !== undefined)
    assert(updatedNode.value !== null)
    assert.equal(updatedNode.value.comment, undefined)
    assert.equal(config.getResources(Repository)[0][property], description)
  })

  it('does not clear comments on same member addition', async () => {
    const config = Config.FromPath()

    const comment = 'This is a comment'

    const member = config.getResources(Member)[0]

    const nodes = config.document.getIn(['members', member.role]) as Collection
    const node = nodes.items[0] as {comment?: string}
    node.comment = comment

    config.addResource(member)

    const updatedMembers = config.document.getIn([
      'members',
      member.role
    ]) as Collection

    assert.notEqual(
      (updatedMembers.items as {comment?: string}[]).some(
        i => i.comment === comment
      ),
      undefined
    )
  })

  it('does not clear comments on repository property updates to the same value', async () => {
    const config = Config.FromPath()

    const comment = 'This is a comment'
    const property = 'description'

    const repository = config.getResources(Repository)[0]

    assert.notEqual(repository[property], undefined)

    const repositories = config.document.getIn([
      'repositories',
      repository.name
    ]) as Collection
    const nodes = repositories.items as YAML.Pair<
      YAML.Scalar,
      {comment?: string}
    >[]
    const node = nodes.find(i => i.key.value === property)
    assert(node !== undefined)
    assert(node.value !== null)
    node.value.comment = comment

    config.addResource(repository)

    const updatedRepositories = config.document.getIn([
      'repositories',
      repository.name
    ]) as Collection
    const updatedNodes = updatedRepositories.items as YAML.Pair<
      YAML.Scalar,
      {comment?: string}
    >[]
    const updatedNode = updatedNodes.find(i => i.key.value === property)
    assert(updatedNode !== undefined)
    assert(updatedNode.value !== null)
    assert.equal(updatedNode.value.comment, comment)
  })

  it('can add a repository followed by a repository branch protection rule', async () => {
    const config = new Config('{}')

    config.addResource(new Repository('test'))
    config.addResource(new RepositoryBranchProtectionRule('test', 'main'))

    assert.equal(config.getResources(RepositoryBranchProtectionRule).length, 1)
    assert.equal(config.getResources(Repository).length, 1)
  })

  it('can add a repository branch protection rule followed by a repository', async () => {
    const config = new Config('{}')

    config.addResource(new RepositoryBranchProtectionRule('test', 'main'))
    config.addResource(new Repository('test'))

    assert.equal(config.getResources(RepositoryBranchProtectionRule).length, 1)
    assert.equal(config.getResources(Repository).length, 1)
  })

  it('does not remove properties when adding a team', async () => {
    const config = Config.FromPath()

    const team = config.getResources(Team)[0]
    const definedValues = Object.values(
      resourceToPlain(team) as Record<string, unknown>
    ).filter(v => v !== undefined)
    assert.notEqual(definedValues.length, 0)
    config.addResource(new Team(team.name), false)

    const updatedTeam = config.getResources(Team)[0]
    const updatedDefinedValues = Object.values(
      resourceToPlain(updatedTeam) as Record<string, unknown>
    ).filter(v => v !== undefined)
    assert.notEqual(updatedDefinedValues.length, 0)
  })

  it('does remove undefined properties when adding a team with delete flag set', async () => {
    const config = Config.FromPath()

    const team = config.getResources(Team)[0]
    const definedValues = Object.values(
      resourceToPlain(team) as Record<string, unknown>
    ).filter(v => v !== undefined)
    assert.notEqual(definedValues.length, 0)
    config.addResource(new Team(team.name), true)

    const updatedTeam = config.getResources(Team)[0]
    const updatedDefinedValues = Object.values(
      resourceToPlain(updatedTeam) as Record<string, unknown>
    ).filter(v => v !== undefined)
    assert.equal(updatedDefinedValues.length, 0)
  })

  it('formats config deterministically', async () => {
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
      .find(m => m.username === 'undefined')
    assert(undefinedMember !== undefined)
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

    assert.equal(formatted, expected)
  })

  it('can add and remove resources through sync', async () => {
    const config = new Config('{}')
    const desiredResources: Resource[] = []
    let resources = config.getAllResources()

    config.sync(desiredResources)
    assert.equal(resources.length, desiredResources.length)

    desiredResources.push(new Repository('test'))
    desiredResources.push(new Repository('test2'))
    desiredResources.push(new Repository('test3'))
    desiredResources.push(new Repository('test4'))

    config.sync(desiredResources)
    resources = config.getAllResources()
    assert.equal(resources.length, desiredResources.length)

    desiredResources.pop()
    desiredResources.pop()

    config.sync(desiredResources)
    resources = config.getAllResources()
    assert.equal(resources.length, desiredResources.length)
  })

  it('clears and re-adds repository fields when archiving/unarchiving', async () => {
    const config = Config.FromPath()
    const state = await State.New()

    const archivedRepository = config
      .getResources(Repository)
      .find(r => r.archived)
    assert(archivedRepository !== undefined)
    const unarchivedRepository = config
      .getResources(Repository)
      .find(r => !r.archived)
    assert(unarchivedRepository !== undefined)

    assert.equal(archivedRepository.archived, true)
    assert.equal(archivedRepository.visibility, undefined)

    assert.equal(unarchivedRepository.archived, false)
    assert.notEqual(unarchivedRepository.visibility, undefined)

    archivedRepository.archived = false
    unarchivedRepository.archived = true

    config.addResource(archivedRepository)
    config.addResource(unarchivedRepository)

    await toggleArchivedRepos(state, config)

    const previouslyArchivedRepository = config.findResource(archivedRepository)
    assert(previouslyArchivedRepository !== undefined)
    const previouslyUnarchivedRepository =
      config.findResource(unarchivedRepository)
    assert(previouslyUnarchivedRepository !== undefined)

    assert.equal(previouslyArchivedRepository.archived, false)
    assert.notEqual(previouslyArchivedRepository.visibility, undefined)

    assert.equal(previouslyUnarchivedRepository.archived, true)
    assert.equal(previouslyUnarchivedRepository.visibility, undefined)
  })
})
