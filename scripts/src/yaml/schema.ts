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
import {RepositoryLabel} from '../resources/repository-label'

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

export class Path {
  constructor(...path: (string | number)[]) {
    this._path = path
  }

  private _path: (string | number)[]

  get(): (string | number)[] {
    return this._path
  }

  toYAML(): (YAML.ParsedNode | number)[] {
    return this._path.map(e => (typeof e === 'number' ? e : yamlify(e)))
  }

  toString(): string {
    return this._path.join('.')
  }

  equals(other: Path): boolean {
    return this.toString() === other.toString()
  }

  extend(...path: (string | number)[]): Path {
    return new Path(...this._path, ...path)
  }
}

export class ConfigSchema {
  members?: {
    [role in MemberRole]?: Member[]
  }
  repositories?: Record<string, Repository & RepositoryExtension>
  teams?: Record<string, Team & TeamExtension>
}
