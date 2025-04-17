import 'reflect-metadata'

import {before, describe, it} from 'node:test'
import assert from 'node:assert'
import {mockGitHub} from './github.js'
import {GitHub} from '../src/github.js'

describe('github', () => {
  let github: GitHub

  before(async () => {
    mockGitHub({
      invitations: [
        {
          login: 'ignored'
        },
        {
          login: 'unignored'
        }
      ],
      members: [
        {
          login: 'ignored'
        },
        {
          login: 'unignored'
        }
      ],
      repositories: [
        {
          name: 'ignored',
          branchProtectionRules: [
            {
              pattern: 'ignored'
            },
            {
              pattern: 'unignored'
            }
          ],
          collaborators: [
            {
              login: 'ignored'
            },
            {
              login: 'unignored'
            }
          ],
          invitations: [
            {
              login: 'ignored'
            },
            {
              login: 'unignored'
            }
          ],
          labels: [
            {
              name: 'ignored'
            },
            {
              name: 'unignored'
            }
          ]
        },
        {
          name: 'unignored',
          branchProtectionRules: [
            {
              pattern: 'ignored'
            },
            {
              pattern: 'unignored'
            }
          ],
          collaborators: [
            {
              login: 'ignored'
            },
            {
              login: 'unignored'
            }
          ],
          invitations: [
            {
              login: 'ignored'
            },
            {
              login: 'unignored'
            }
          ],
          labels: [
            {
              name: 'ignored'
            },
            {
              name: 'unignored'
            }
          ]
        }
      ],
      teams: [
        {
          name: 'ignored',
          members: [
            {
              login: 'ignored'
            },
            {
              login: 'unignored'
            }
          ],
          invitations: [
            {
              login: 'ignored'
            },
            {
              login: 'unignored'
            }
          ],
          repositories: [
            {
              name: 'ignored'
            },
            {
              name: 'unignored'
            }
          ]
        },
        {
          name: 'unignored',
          members: [
            {
              login: 'ignored'
            },
            {
              login: 'unignored'
            }
          ],
          invitations: [
            {
              login: 'ignored'
            },
            {
              login: 'unignored'
            }
          ],
          repositories: [
            {
              name: 'ignored'
            },
            {
              name: 'unignored'
            }
          ]
        }
      ]
    })
    github = await GitHub.getGitHub()
  })

  it('listInvitations', async () => {
    const invitations = await github.listInvitations()
    assert.ok(invitations.length > 0)
    assert.ok(!invitations.some(i => i.login === 'ignored'))
  })

  it('listMembers', async () => {
    const members = await github.listMembers()
    assert.ok(members.length > 0)
    assert.ok(!members.some(m => m.user?.login === 'ignored'))
  })

  it('listRepositories', async () => {
    const repositories = await github.listRepositories()
    assert.ok(repositories.length > 0)
    assert.ok(!repositories.some(r => r.name === 'ignored'))
  })

  it('listRepositoryBranchProtectionRules', async () => {
    const rules = await github.listRepositoryBranchProtectionRules()
    assert.ok(rules.length > 0)
    assert.ok(!rules.some(r => r.repository.name === 'ignored'))
    // NOTE: Ignoring rules by pattern is not supported yet
    assert.ok(rules.some(r => r.branchProtectionRule.pattern === 'ignored'))
  })

  it('listRepositoryCollaborators', async () => {
    const collaborators = await github.listRepositoryCollaborators()
    assert.ok(collaborators.length > 0)
    assert.ok(!collaborators.some(c => c.repository.name === 'ignored'))
    assert.ok(!collaborators.some(c => c.collaborator.login === 'ignored'))
  })

  it('listRepositoryInvitations', async () => {
    const invitations = await github.listRepositoryInvitations()
    assert.ok(invitations.length > 0)
    assert.ok(!invitations.some(i => i.repository.name === 'ignored'))
    assert.ok(!invitations.some(i => i.invitee?.login === 'ignored'))
  })

  it('listRepositoryLabels', async () => {
    const labels = await github.listRepositoryLabels()
    assert.ok(labels.length > 0)
    assert.ok(!labels.some(l => l.repository.name === 'ignored'))
    // NOTE: Ignoring labels by name is not supported yet
    assert.ok(labels.some(l => l.label.name === 'ignored'))
  })

  it('listTeams', async () => {
    const teams = await github.listTeams()
    assert.ok(teams.length > 0)
    assert.ok(!teams.some(t => t.name === 'ignored'))
  })

  it('listTeamInvitations', async () => {
    const invitations = await github.listTeamInvitations()
    assert.ok(invitations.length > 0)
    assert.ok(!invitations.some(i => i.team.name === 'ignored'))
    assert.ok(!invitations.some(i => i.invitation.login === 'ignored'))
  })

  it('listTeamMembers', async () => {
    const members = await github.listTeamMembers()
    assert.ok(members.length > 0)
    assert.ok(!members.some(m => m.team.name === 'ignored'))
    assert.ok(!members.some(m => m.member.login === 'ignored'))
  })

  it('listTeamRepositories', async () => {
    const repositories = await github.listTeamRepositories()
    assert.ok(repositories.length > 0)
    assert.ok(!repositories.some(r => r.team.name === 'ignored'))
    assert.ok(!repositories.some(r => r.repository.name === 'ignored'))
  })
})
