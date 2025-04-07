import {Role as MemberRole} from '../resources/member.js'
import {Repository} from '../resources/repository.js'
import {RepositoryFile} from '../resources/repository-file.js'
import {Permission as RepositoryCollaboratorPermission} from '../resources/repository-collaborator.js'
import {Permission as RepositoryTeamPermission} from '../resources/repository-team.js'
import {RepositoryBranchProtectionRule} from '../resources/repository-branch-protection-rule.js'
import {RepositoryLabel} from '../resources/repository-label.js'
import {Role as TeamRole} from '../resources/team-member.js'
import {Team} from '../resources/team.js'
import * as YAML from 'yaml'
import {yamlify} from '../utils.js'

type TeamMember = string
type RepositoryCollaborator = string
type RepositoryTeam = string
type Member = string

interface RepositoryExtension {
  files?: Record<string, RepositoryFile>
  collaborators?: {
    [permission in RepositoryCollaboratorPermission]?: RepositoryCollaborator[]
  }
  teams?: {
    [permission in RepositoryTeamPermission]?: RepositoryTeam[]
  }
  branch_protection?: Record<string, RepositoryBranchProtectionRule>
  labels?: Record<string, RepositoryLabel>
}

interface TeamExtension {
  members?: {
    [role in TeamRole]?: TeamMember[]
  }
}

export type Path = (string | number)[]

export class ConfigSchema {
  members?: {
    [role in MemberRole]?: Member[]
  }
  repositories?: Record<string, Repository & RepositoryExtension>
  teams?: Record<string, Team & TeamExtension>
}

export function pathToYAML(path: Path): (YAML.ParsedNode | number)[] {
  return path.map(e => (typeof e === 'number' ? e : yamlify(e)))
}
