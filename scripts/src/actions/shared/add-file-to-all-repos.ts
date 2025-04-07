import {Config} from '../../yaml/config'
import {Repository} from '../../resources/repository'
import {RepositoryFile} from '../../resources/repository-file'
import * as core from '@actions/core'

export async function runAddFileToAllRepos(
  name: string,
  content: string = name,
  repositoryFilter: (repository: Repository) => boolean = (): boolean => true
): Promise<void> {
  const config = Config.FromPath()

  await addFileToAllRepos(config, name, content, repositoryFilter)

  config.save()
}

export async function addFileToAllRepos(
  config: Config,
  name: string,
  content: string = name,
  repositoryFilter: (repository: Repository) => boolean = () => true
): Promise<void> {
  const repositories = config
    .getResources(Repository)
    .filter(r => !r.archived)
    .filter(repositoryFilter)

  for (const repository of repositories) {
    const file = new RepositoryFile(repository.name, name)
    file.content = content
    if (!config.someResource(file)) {
      core.info(`Adding ${file.file} file to ${file.repository} repository`)
      config.addResource(file)
    }
  }
}
