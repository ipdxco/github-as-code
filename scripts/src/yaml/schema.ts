import {Role as MemberRole} from '../resources/member';
import {Repository} from '../resources/repository'
import {RepositoryFile} from '../resources/repository-file';
import {Permission as RepositoryCollaboratorPermission} from '../resources/repository-collaborator';
import {Permission as RepositoryTeamPermission} from '../resources/repository-team';
import {RepositoryBranchProtectionRule} from '../resources/repository-branch-protection-rule';
import {Role as TeamRole} from '../resources/team-member';
import {Team} from '../resources/team';
import * as YAML from "yaml"
import { yamlify } from '../utils';

type TeamMember = string
type RepositoryCollaborator = string
type RepositoryTeam = string
type Member = string

interface RepositoryExtension {
  files?: Record<string, RepositoryFile>
  collaborators?: Record<RepositoryCollaboratorPermission, RepositoryCollaborator[]>
  teams?: Record<RepositoryTeamPermission, RepositoryTeam[]>
  branch_protection?: Record<string, RepositoryBranchProtectionRule>
}

interface TeamExtension {
  members?: Record<TeamRole, TeamMember[]>
}

export type Path = (string | number)[]

export class ConfigSchema {
  members?: Record<MemberRole, Member[]>
  repositories?: Record<string, Repository & RepositoryExtension>
  teams?: Record<string, Team & TeamExtension>
}

export function pathToYAML(path: Path): (YAML.ParsedNode | number)[] {
  return path.map(e => typeof e === 'number' ? e : yamlify(e))
}
