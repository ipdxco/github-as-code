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
    return [] as any
  },
  listRepositories: async () => {
    return [] as any
  },
  listTeams: async () => {
    return [] as any
  },
  listRepositoryCollaborators: async () => {
    return [] as any
  },
  listRepositoryBranchProtectionRules: async () => {
    return [] as any
  },
  listTeamRepositories: async () => {
    return [] as any
  },
  listTeamMembers: async () => {
    return [] as any
  },
  getRepositoryFile: async (_repository: string, _path: string) => {
    return undefined
  },
  listInvitations: async () => {
    return [] as any
  },
  listRepositoryInvitations: async () => {
    return [] as any
  },
  listTeamInvitations: async () => {
    return [] as any
  },
  listRepositoryLabels: async () => {
    return [] as any
  }
} as GitHub

global.ConfigResourceCounts = {
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
global.ConfigResourcesCount = Object.values(global.ConfigResourceCounts).reduce(
  (a, b) => a + b,
  0
)
global.StateResourceCounts = {
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
global.StateResourcesCount = Object.values(global.StateResourceCounts).reduce(
  (a, b) => a + b,
  0
)
