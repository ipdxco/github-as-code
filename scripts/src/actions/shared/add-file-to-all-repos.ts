import {Config} from '../../yaml/config'
import {Repository} from '../../resources/repository'
import {RepositoryFile} from '../../resources/repository-file'

export async function addFileToAllRepos(
  name: string,
  content: string,
  exclude: string[] = []
): Promise<void> {
  const config = Config.FromPath()

  const repositories = config
    .getResources(Repository)
    .filter(r => !r.archived)
    .filter(r => !exclude.includes(r.name))

  for (const repository of repositories) {
    const file = new RepositoryFile(repository.name, name)
    file.content = content
    if (!config.someResource(file)) {
      console.log(`Adding ${file.file} file to ${file.repository} repository`)
      config.addResource(file)
    }
  }

  config.save()
}
