import {Member} from '../../src/resources/member.js'
import {RepositoryBranchProtectionRule} from '../../src/resources/repository-branch-protection-rule.js'
import {RepositoryCollaborator} from '../../src/resources/repository-collaborator.js'
import {RepositoryFile} from '../../src/resources/repository-file.js'
import {RepositoryLabel} from '../../src/resources/repository-label.js'
import {RepositoryTeam} from '../../src/resources/repository-team.js'
import {Repository} from '../../src/resources/repository.js'
import {TeamMember} from '../../src/resources/team-member.js'
import {Team} from '../../src/resources/team.js'

export const ConfigResourceCounts = {
  [Member.name]: 2,
  [Repository.name]: 7,
  [Team.name]: 2,
  [RepositoryCollaborator.name]: 1,
  [RepositoryBranchProtectionRule.name]: 1,
  [RepositoryTeam.name]: 6,
  [TeamMember.name]: 2,
  [RepositoryFile.name]: 1,
  [RepositoryLabel.name]: 3
}
export const ConfigResourcesCount = Object.values(ConfigResourceCounts).reduce(
  (a, b) => a + b,
  0
)
export const StateResourceCounts = {
  [Member.name]: 2,
  [Repository.name]: 7,
  [Team.name]: 2,
  [RepositoryCollaborator.name]: 1,
  [RepositoryBranchProtectionRule.name]: 1,
  [RepositoryTeam.name]: 7,
  [TeamMember.name]: 2,
  [RepositoryFile.name]: 1,
  [RepositoryLabel.name]: 3
}
export const StateResourcesCount = Object.values(StateResourceCounts).reduce(
  (a, b) => a + b,
  0
)
