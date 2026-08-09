import 'reflect-metadata'

import {describe, it} from 'node:test'
import assert from 'node:assert'
import {
  getEnvironment,
  hasAllowDestroyChange,
  validateRemovedMembersHaveNoDanglingAccess
} from '../../src/actions/classify-allow-destroy.js'
import {Config} from '../../src/yaml/config.js'
import {State} from '../../src/terraform/state.js'
import {Locals} from '../../src/terraform/locals.js'

function setManagedResourceTypes(resourceTypes: string[]): void {
  Locals.locals = {
    resource_types: resourceTypes,
    ignore: {
      repositories: [],
      teams: [],
      users: []
    }
  }
}

function state(source: object): State {
  return new State(JSON.stringify(source))
}

describe('allow destroy classification', () => {
  it('routes repository deletes to allow-destroy environments', async () => {
    setManagedResourceTypes(['github_repository', 'github_membership'])

    const allowDestroy = await hasAllowDestroyChange(
      new Config(`
repositories:
  kept: {}
`),
      state({
        values: {
          root_module: {
            resources: [
              {
                mode: 'managed',
                type: 'github_repository',
                values: {name: 'kept'}
              },
              {
                mode: 'managed',
                type: 'github_repository',
                values: {name: 'removed'}
              }
            ]
          }
        }
      })
    )

    assert.equal(allowDestroy, true)
    assert.equal(getEnvironment('read', allowDestroy), 'read-allow-destroy')
    assert.equal(getEnvironment('write', allowDestroy), 'write-allow-destroy')
  })

  it('routes membership deletes to allow-destroy environments', async () => {
    setManagedResourceTypes(['github_repository', 'github_membership'])

    const allowDestroy = await hasAllowDestroyChange(
      new Config(`
members:
  admin:
    - kept
`),
      state({
        values: {
          root_module: {
            resources: [
              {
                mode: 'managed',
                type: 'github_membership',
                values: {username: 'kept', role: 'admin'}
              },
              {
                mode: 'managed',
                type: 'github_membership',
                values: {username: 'removed', role: 'admin'}
              }
            ]
          }
        }
      })
    )

    assert.equal(allowDestroy, true)
  })

  it('keeps repository and membership updates in normal environments', async () => {
    setManagedResourceTypes(['github_repository', 'github_membership'])

    const allowDestroy = await hasAllowDestroyChange(
      new Config(`
members:
  member:
    - octocat
repositories:
  github:
    description: updated
`),
      state({
        values: {
          root_module: {
            resources: [
              {
                mode: 'managed',
                type: 'github_repository',
                values: {name: 'github', description: 'old'}
              },
              {
                mode: 'managed',
                type: 'github_membership',
                values: {username: 'octocat', role: 'member'}
              }
            ]
          }
        }
      })
    )

    assert.equal(allowDestroy, false)
    assert.equal(getEnvironment('read', allowDestroy), 'read')
    assert.equal(getEnvironment('write', allowDestroy), 'write')
  })

  it('ignores deletes for other resource types', async () => {
    setManagedResourceTypes(['github_team'])

    const allowDestroy = await hasAllowDestroyChange(
      new Config('{}'),
      state({
        values: {
          root_module: {
            resources: [
              {
                mode: 'managed',
                type: 'github_team',
                values: {name: 'removed'}
              }
            ]
          }
        }
      })
    )

    assert.equal(allowDestroy, false)
  })

  it('ignores repository and membership types that are not managed', async () => {
    setManagedResourceTypes([])

    const allowDestroy = await hasAllowDestroyChange(
      new Config('{}'),
      state({
        values: {
          root_module: {
            resources: [
              {
                mode: 'managed',
                type: 'github_repository',
                values: {name: 'removed'}
              },
              {
                mode: 'managed',
                type: 'github_membership',
                values: {username: 'removed', role: 'member'}
              }
            ]
          }
        }
      })
    )

    assert.equal(allowDestroy, false)
  })

  it('fails when removing a member who remains in a team', async () => {
    setManagedResourceTypes(['github_membership'])

    await assert.rejects(
      validateRemovedMembersHaveNoDanglingAccess(
        new Config(`
teams:
  maintainers:
    members:
      member:
        - removed
`),
        state({
          values: {
            root_module: {
              resources: [
                {
                  mode: 'managed',
                  type: 'github_membership',
                  values: {username: 'removed', role: 'member'}
                }
              ]
            }
          }
        })
      ),
      /removed is still a member of team maintainers/
    )
  })

  it('fails when removing a member who keeps direct private repository access', async () => {
    setManagedResourceTypes(['github_membership'])

    await assert.rejects(
      validateRemovedMembersHaveNoDanglingAccess(
        new Config(`
repositories:
  private-repo:
    collaborators:
      pull:
        - removed
    visibility: private
`),
        state({
          values: {
            root_module: {
              resources: [
                {
                  mode: 'managed',
                  type: 'github_membership',
                  values: {username: 'removed', role: 'member'}
                }
              ]
            }
          }
        })
      ),
      /removed still has direct access to private repository private-repo/
    )
  })

  it('allows member removal when team and private direct access are removed too', async () => {
    setManagedResourceTypes(['github_membership'])

    await validateRemovedMembersHaveNoDanglingAccess(
      new Config(`
repositories:
  public-repo:
    collaborators:
      pull:
        - removed
    visibility: public
`),
      state({
        values: {
          root_module: {
            resources: [
              {
                mode: 'managed',
                type: 'github_membership',
                values: {username: 'removed', role: 'member'}
              },
              {
                mode: 'managed',
                type: 'github_repository',
                values: {name: 'private-repo', visibility: 'private'}
              },
              {
                mode: 'managed',
                type: 'github_repository_collaborator',
                values: {
                  username: 'removed',
                  repository: 'private-repo',
                  permission: 'pull'
                }
              }
            ]
          }
        }
      })
    )
  })
})
