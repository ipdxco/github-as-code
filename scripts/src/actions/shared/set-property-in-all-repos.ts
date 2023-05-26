import {Config} from '../../yaml/config'
import {Repository} from '../../resources/repository'
import * as core from '@actions/core'

export async function setPropertyInAllRepos(
  name: keyof Repository,
  value: any,
  repositoryFilter: (repository: Repository) => boolean = () => true
): Promise<void> {
  const config = Config.FromPath()

  const repositories = config
    .getResources(Repository)
    .filter(r => !r.archived)
    .filter(repositoryFilter)

  for (const repository of repositories) {
    const v = (repository as any)[name]
    if (v !== value) {
      ;(repository as any)[name] = value
      core.info(
        `Setting ${name} property to ${value} for ${repository.name} repository`
      )
      config.addResource(repository)
    }
  }

  config.save()
}
