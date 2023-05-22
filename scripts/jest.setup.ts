import 'reflect-metadata'
import {Member} from './src/resources/member'
import {Repository} from './src/resources/repository'
import {Team} from './src/resources/team'
import {RepositoryCollaborator} from './src/resources/repository-collaborator'
import {RepositoryBranchProtectionRule} from './src/resources/repository-branch-protection-rule'
import {RepositoryTeam} from './src/resources/repository-team'
import {TeamMember} from './src/resources/team-member'
import {RepositoryFile} from './src/resources/repository-file'
import {RepositoryLabel} from './src/resources/repository-label'
import {GitHub} from './src/github'

jest.mock('./src/env', () => ({
  TF_EXEC: 'false',
  TF_LOCK: 'false',
  TF_WORKING_DIR: '__tests__/__resources__/terraform',
  GITHUB_DIR: '__tests__/__resources__/github',
  FILES_DIR: '__tests__/__resources__/files',
  GITHUB_ORG: 'default'
}))

GitHub.github = {
  listMembers: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositories: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeams: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositoryCollaborators: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositoryBranchProtectionRules: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeamRepositories: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeamMembers: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  getRepositoryFile: async (_repository: string, _path: string) => {
    return undefined
  },
  listInvitations: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositoryInvitations: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listTeamInvitations: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  },
  listRepositoryLabels: async () => {
    return [] as any // eslint-disable-line @typescript-eslint/no-explicit-any
  }
} as GitHub

global.ResourceCounts = {
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
global.ResourcesCount = Object.values(global.ResourceCounts).reduce(
  (a, b) => a + b,
  0
)
global.UniqueResourceCounts = {
  [Member.name]: 2,
  [Repository.name]: 7,
  [Team.name]: 2,
  [RepositoryCollaborator.name]: 1,
  [RepositoryBranchProtectionRule.name]: 1,
  [RepositoryTeam.name]: 7,
  [TeamMember.name]: 2,
  [RepositoryFile.name]: 1,
  [RepositoryLabel.name]: 2
}
global.UniqueResourcesCount = Object.values(global.UniqueResourceCounts).reduce(
  (a, b) => a + b,
  0
)
