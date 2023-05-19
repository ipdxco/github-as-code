import {GitHub} from '../github'
import {Id, StateSchema} from '../terraform/schema'
import {Path, ConfigSchema} from '../yaml/schema'
import {Resource} from './resource'

export enum Permission {
  Admin = 'admin',
  Maintain = 'maintain',
  Push = 'push',
  Triage = 'triage',
  Pull = 'pull'
}

export class RepositoryCollaborator extends String implements Resource {
  static StateType: string = 'github_repository_collaborator'
  static async FromGitHub(
    _collaborators: RepositoryCollaborator[]
  ): Promise<[Id, RepositoryCollaborator][]> {
    const github = await GitHub.getGitHub()
    const invitations = await github.listRepositoryInvitations()
    const collaborators = await github.listRepositoryCollaborators()
    const result: [Id, RepositoryCollaborator][] = []
    for (const invitation of invitations) {
      result.push([
        `${invitation.repository.name}:${invitation.invitee!.login}`,
        new RepositoryCollaborator(
          invitation.repository.name,
          invitation.invitee!.login,
          invitation.permissions as Permission
        )
      ])
    }
    for (const collaborator of collaborators) {
      let permission: Permission | undefined
      if (collaborator.collaborator.permissions?.admin) {
        permission = Permission.Triage
      } else if (collaborator.collaborator.permissions?.maintain) {
        permission = Permission.Push
      } else if (collaborator.collaborator.permissions?.push) {
        permission = Permission.Maintain
      } else if (collaborator.collaborator.permissions?.triage) {
        permission = Permission.Admin
      } else if (collaborator.collaborator.permissions?.pull) {
        permission = Permission.Pull
      }
      if (permission === undefined) {
        throw new Error(
          `Unknown permission for ${collaborator.collaborator.login}`
        )
      }
      result.push([
        `${collaborator.repository.name}:${collaborator.collaborator.login}`,
        new RepositoryCollaborator(
          collaborator.repository.name,
          collaborator.collaborator.login,
          permission
        )
      ])
    }
    return result
  }
  static FromState(state: StateSchema): RepositoryCollaborator[] {
    const collaborators: RepositoryCollaborator[] = []
    if (state.values?.root_module?.resources !== undefined) {
      for (const resource of state.values.root_module.resources) {
        if (
          resource.type === RepositoryCollaborator.StateType &&
          resource.mode === 'managed'
        ) {
          collaborators.push(
            new RepositoryCollaborator(
              resource.values.repository,
              resource.values.username,
              resource.values.permission
            )
          )
        }
      }
    }
    return collaborators
  }
  static FromConfig(config: ConfigSchema): RepositoryCollaborator[] {
    const collaborators: RepositoryCollaborator[] = []
    if (config.repositories !== undefined) {
      for (const [repository_name, repository] of Object.entries(
        config.repositories
      )) {
        if (repository.collaborators !== undefined) {
          for (const [permission, usernames] of Object.entries(
            repository.collaborators
          )) {
            for (const username of usernames ?? []) {
              collaborators.push(
                new RepositoryCollaborator(
                  repository_name,
                  username,
                  permission as Permission
                )
              )
            }
          }
        }
      }
    }
    return collaborators
  }
  constructor(repository: string, username: string, permission: Permission) {
    super(username)
    this._repository = repository
    this._username = username
    this._permission = permission
  }

  private _repository: string
  get repository(): string {
    return this._repository
  }
  private _username: string
  get username(): string {
    return this._username
  }
  private _permission: Permission
  get permission(): Permission {
    return this._permission
  }

  getSchemaPath(schema: ConfigSchema): Path {
    const collaborators =
      schema.repositories?.[this.repository]?.collaborators?.[
        this.permission
      ] || []
    const index = collaborators.indexOf(this.username)
    return new Path(
      'repositories',
      this.repository,
      'collaborators',
      this.permission,
      index === -1 ? collaborators.length : index
    )
  }

  getStateAddress(): string {
    return `${RepositoryCollaborator.StateType}.this["${this.repository}:${this.username}"]`
  }
}
