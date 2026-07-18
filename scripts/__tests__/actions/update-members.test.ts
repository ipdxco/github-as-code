import 'reflect-metadata'

import assert from 'node:assert'
import {describe, it} from 'node:test'
import {Config} from '../../src/yaml/config.js'
import {
  parseCutoffDate,
  parseLimit,
  parseOrganizationMembership,
  selectMembersForUpdate,
  updateMembersConfig
} from '../../src/actions/update-members.js'
import {Member} from '../../src/resources/member.js'
import {TeamMember} from '../../src/resources/team-member.js'
import {RepositoryCollaborator} from '../../src/resources/repository-collaborator.js'

describe('update members', () => {
  it('requires cutoff date or only list', () => {
    const config = new Config('members:\n  member:\n    - alice\n')

    assert.throws(() =>
      selectMembersForUpdate(config, [], {
        ignore: [],
        only: [],
        publicRepoAccess: 'retain',
        organizationMembership: 'keep'
      })
    )
  })

  it('validates workflow inputs', () => {
    assert.equal(
      parseCutoffDate('2025-01-02')?.toISOString(),
      '2025-01-02T00:00:00.000Z'
    )
    assert.equal(parseLimit('2'), 2)
    assert.equal(parseOrganizationMembership('keep'), 'keep')
    assert.equal(parseOrganizationMembership('remove'), 'remove')
    assert.throws(() => parseCutoffDate('01-02-2025'))
    assert.throws(() => parseLimit('0'))
    assert.throws(() => parseOrganizationMembership('invalid'))
  })

  it('selects inactive members with only, ignore, limit, and KEEP handling', () => {
    const config = new Config(`
members:
  member:
    - active
    - ignored
    - kept # KEEP: manual exception
    - manual
    - never-active
    - old
`)

    const selected = selectMembersForUpdate(
      config,
      [
        {username: 'active', latestActivity: new Date('2025-01-01T00:00:00Z')},
        {username: 'old', latestActivity: new Date('2023-01-01T00:00:00Z')}
      ],
      {
        cutoffDate: new Date('2024-01-01T00:00:00Z'),
        limit: 2,
        ignore: ['ignored'],
        only: ['active', 'ignored', 'kept', 'manual', 'never-active', 'old'],
        publicRepoAccess: 'retain',
        organizationMembership: 'keep'
      }
    )

    assert.deepEqual(selected, ['manual', 'never-active'])
  })

  it('retains effective public repository access when configured', () => {
    const config = new Config(`
members:
  member:
    - alice
repositories:
  private-repo:
    collaborators:
      pull:
        - alice
    teams:
      admin:
        - maintainers
    visibility: private
  public-repo:
    collaborators:
      pull:
        - alice
    teams:
      push:
        - maintainers
    visibility: public
teams:
  maintainers:
    members:
      member:
        - alice
`)

    updateMembersConfig(config, ['alice'], 'retain', 'keep')

    assert.equal(
      config
        .getResources(TeamMember)
        .some(teamMember => teamMember.username === 'alice'),
      false
    )
    assert.equal(
      config
        .getResources(RepositoryCollaborator)
        .some(
          collaborator =>
            collaborator.username === 'alice' &&
            collaborator.repository === 'private-repo'
        ),
      false
    )

    const publicCollaborator = config
      .getResources(RepositoryCollaborator)
      .find(
        collaborator =>
          collaborator.username === 'alice' &&
          collaborator.repository === 'public-repo'
      )

    assert.equal(publicCollaborator?.permission, 'push')
  })

  it('removes public repository access when configured', () => {
    const config = new Config(`
members:
  member:
    - alice
repositories:
  public-repo:
    collaborators:
      pull:
        - alice
    teams:
      push:
        - maintainers
    visibility: public
teams:
  maintainers:
    members:
      member:
        - alice
`)

    updateMembersConfig(config, ['alice'], 'remove', 'keep')

    assert.equal(
      config
        .getResources(RepositoryCollaborator)
        .some(collaborator => collaborator.username === 'alice'),
      false
    )
  })

  it('removes organization membership when configured', () => {
    const config = new Config(`
members:
  member:
    - alice
    - bob
repositories:
  public-repo:
    visibility: public
`)

    updateMembersConfig(config, ['alice'], 'remove', 'remove')

    assert.deepEqual(
      config.getResources(Member).map(member => member.username),
      ['bob']
    )
  })
})
