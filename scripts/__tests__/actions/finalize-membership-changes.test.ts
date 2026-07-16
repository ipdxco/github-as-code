import 'reflect-metadata'

import assert from 'node:assert'
import {describe, it} from 'node:test'
import {Config} from '../../src/yaml/config.js'
import {
  parseFinalizeMembershipMode,
  planFinalizeMembershipChanges
} from '../../src/actions/finalize-membership-changes.js'

describe('finalize membership changes', () => {
  it('validates mode input', () => {
    assert.equal(parseFinalizeMembershipMode('both'), 'both')
    assert.throws(() => parseFinalizeMembershipMode('invalid'))
  })

  it('plans filtered conversion and removal targets', () => {
    const config = new Config(`
members:
  member:
    - outside-candidate
    - no-member-candidate
    - ignored
repositories:
  public-repo:
    collaborators:
      pull:
        - outside-candidate
        - ignored
    visibility: public
`)

    const plan = planFinalizeMembershipChanges(
      config,
      'both',
      ['ignored'],
      ['outside-candidate', 'no-member-candidate', 'ignored']
    )

    assert.deepEqual(plan.potentialOutsideCollaborators, ['outside-candidate'])
    assert.deepEqual(plan.potentialNoMembers, ['no-member-candidate'])
  })
})
