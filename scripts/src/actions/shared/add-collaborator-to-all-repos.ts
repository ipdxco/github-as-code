import {Config} from '../../yaml/config.js'
import {Repository} from '../../resources/repository.js'
import * as core from '@actions/core'
import {
  Permission,
  RepositoryCollaborator
} from '../../resources/repository-collaborator.js'

export async function runAddCollaboratorToAllRepos(
  username: string,
  permission: Permission,
  repositoryFilter: (repository: Repository) => boolean = (): boolean => true
): Promise<void> {
  const config = Config.FromPath()

  await addCollaboratorToAllRepos(
    config,
    username,
    permission,
    repositoryFilter
  )

  config.save()
}

export async function addCollaboratorToAllRepos(
  config: Config,
  username: string,
  permission: Permission,
  repositoryFilter: (repository: Repository) => boolean = () => true
): Promise<void> {
  const collaborators = config
    .getResources(RepositoryCollaborator)
    .filter(c => c.username === username)

  const repositories = config
    .getResources(Repository)
    .filter(r => !r.archived)
    .filter(repositoryFilter)
    .filter(r => !collaborators.some(c => c.repository === r.name))

  for (const repository of repositories) {
    const collaborator = new RepositoryCollaborator(
      repository.name,
      username,
      permission
    )
    core.info(
      `Adding ${collaborator.username} as a collaborator with ${collaborator.permission} access to ${collaborator.repository} repository`
    )
    config.addResource(collaborator)
  }
}
