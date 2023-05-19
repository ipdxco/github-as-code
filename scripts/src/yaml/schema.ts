import {Role as MemberRole} from '../resources/member'
import {Repository} from '../resources/repository'
import {RepositoryFile} from '../resources/repository-file'
import {Permission as RepositoryCollaboratorPermission} from '../resources/repository-collaborator'
import {Permission as RepositoryTeamPermission} from '../resources/repository-team'
import {RepositoryBranchProtectionRule} from '../resources/repository-branch-protection-rule'
import {Role as TeamRole} from '../resources/team-member'
import {Team} from '../resources/team'
import * as YAML from 'yaml'
import {yamlify} from '../utils'
import {RepositoryLabels} from '../resources/repository-labels'

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
  repositories?: Record<
    string,
    Repository & RepositoryExtension & RepositoryLabels
  >
  teams?: Record<string, Team & TeamExtension>
}

export function pathToYAML(path: Path): (YAML.ParsedNode | number)[] {
  return path.map(e => (typeof e === 'number' ? e : yamlify(e)))
}
