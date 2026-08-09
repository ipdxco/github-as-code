import 'reflect-metadata'

import assert from 'node:assert'
import {describe, it} from 'node:test'
import {Config} from '../../src/yaml/config.js'
import {State} from '../../src/terraform/state.js'
import {
  categorizeAccessSummary,
  getAccessSummaryFrom
} from '../../src/actions/shared/access-summary.js'
import {
  describeAccessChanges,
  describeAccessChangesComment,
  describeAccessReport
} from '../../src/actions/shared/describe-access-changes.js'
import {StateSchema} from '../../src/terraform/schema.js'

describe('access summaries', () => {
  it('categorizes post-change users', () => {
    const config = new Config(`
members:
  member:
    - alice
    - carol
    - dave
    - frank
    - kept # KEEP: manual exception
repositories:
  private-repo:
    collaborators:
      pull:
        - outside
    visibility: private
  public-repo:
    collaborators:
      pull:
        - alice
    visibility: public
  team-only-repo:
    teams:
      push:
        - guests
    visibility: public
  team-repo:
    teams:
      push:
        - maintainers
    visibility: public
teams:
  empty:
    members:
      member:
        - frank
  guests:
    members:
      member:
        - team-only-non-member
  maintainers:
    members:
      member:
        - dave
`)

    const summary = getAccessSummaryFrom(config)
    const categories = categorizeAccessSummary(summary)

    assert.equal(summary.outside.isMember, false)
    assert.equal(summary.outside.isOutsideCollaborator, true)
    assert.equal(summary['team-only-non-member'].isMember, false)
    assert.equal(summary['team-only-non-member'].isOutsideCollaborator, false)
    assert.deepEqual(categories.outsideCollaborators, ['outside'])
    assert.deepEqual(categories.potentialOutsideCollaborators, ['alice'])
    assert.deepEqual(categories.potentialNoMembers, ['carol', 'frank'])
    assert.deepEqual(categories.anyOtherMembers, ['dave', 'kept'])
  })

  it('annotates repository visibility and access path in access changes and summaries', () => {
    const state = new State(
      JSON.stringify({
        values: {
          root_module: {
            resources: [
              {
                mode: 'managed',
                index: 'alice',
                address: 'github_membership.this["alice"]',
                type: 'github_membership',
                values: {
                  username: 'alice',
                  role: 'member'
                }
              },
              {
                mode: 'managed',
                index: 'public-repo',
                address: 'github_repository.this["public-repo"]',
                type: 'github_repository',
                values: {
                  name: 'public-repo',
                  visibility: 'public'
                }
              },
              {
                mode: 'managed',
                index: 'public-repo:alice',
                address:
                  'github_repository_collaborator.this["public-repo:alice"]',
                type: 'github_repository_collaborator',
                values: {
                  repository: 'public-repo',
                  username: 'alice',
                  permission: 'pull'
                }
              }
            ]
          }
        }
      } satisfies StateSchema)
    )
    const config = new Config(`
members:
  member:
    - alice
repositories:
  public-repo:
    collaborators:
      push:
        - alice
    visibility: public
`)

    const changes = describeAccessChanges(state, config)
    const report = describeAccessReport(state, config)

    assert.match(
      changes,
      /will change from having direct pull permission to public-repo \(public\) to having direct push permission to public-repo \(public\)/
    )
    assert.match(report, /<summary>Potential outside collaborators<\/summary>/)
    assert.match(report, /Affected users: alice/)
    assert.match(report, /User alice \(member\):/)
    assert.match(report, /has direct push permission to public-repo \(public\)/)
  })

  it('describes team and mixed repository access paths', () => {
    const state = new State(
      JSON.stringify({values: {root_module: {resources: []}}})
    )
    const config = new Config(`
members:
  member:
    - alice
    - bob
repositories:
  private-repo:
    collaborators:
      pull:
        - bob
    teams:
      admin:
        - owners
      push:
        - maintainers
    visibility: private
teams:
  maintainers:
    members:
      member:
        - alice
  owners:
    members:
      member:
        - bob
`)

    const changes = describeAccessChanges(state, config)
    const report = describeAccessReport(state, config)

    assert.match(
      changes,
      /will gain push permission to private-repo \(private\) through team maintainers/
    )
    assert.match(
      changes,
      /will gain effective admin permission to private-repo \(private\) through direct pull permission and team owners/
    )
    assert.match(
      report,
      /has push permission to private-repo \(private\) through team maintainers/
    )
    assert.match(
      report,
      /has effective admin permission to private-repo \(private\) through direct pull permission and team owners/
    )
  })

  it('keeps routine comments to access changes only', () => {
    const state = new State(
      JSON.stringify({values: {root_module: {resources: []}}})
    )
    const config = new Config(`
members:
  member:
    - alice
`)

    const comment = describeAccessChangesComment(state, config)

    assert.match(comment, /The following access changes/)
    assert.match(comment, /For the full access breakdown/)
    assert.match(comment, /<details><summary>Access Changes<\/summary>/)
    assert.doesNotMatch(comment, /Potential no members/)
    assert.doesNotMatch(comment, /Any other members/)
  })

  it('falls back to workflow output when access change comments are too long', () => {
    const state = new State(
      JSON.stringify({values: {root_module: {resources: []}}})
    )
    const config = new Config(`
members:
  member:
    - alice
`)

    const comment = describeAccessChangesComment(
      state,
      config,
      10,
      'https://github.example/runs/1'
    )

    assert.equal(
      comment,
      'Access changes are too long to post as a comment. Please inspect [the Fix workflow summary or access report artifact](https://github.example/runs/1) instead.'
    )
  })
})
