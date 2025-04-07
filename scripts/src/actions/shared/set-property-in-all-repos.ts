import {Config} from '../../yaml/config'
import {Repository} from '../../resources/repository'
import * as core from '@actions/core'

export async function runSetPropertyInAllRepos(
  name: keyof Repository,
  value: unknown,
  repositoryFilter: (repository: Repository) => boolean = (): boolean => true
): Promise<void> {
  const config = Config.FromPath()

  await setPropertyInAllRepos(config, name, value, repositoryFilter)

  config.save()
}

export async function setPropertyInAllRepos(
  config: Config,
  name: keyof Repository,
  value: unknown,
  repositoryFilter: (repository: Repository) => boolean = () => true
): Promise<void> {
  const repositories = config
    .getResources(Repository)
    .filter(r => !r.archived)
    .filter(repositoryFilter)

  for (const repository of repositories) {
    const v = repository[name]
    if (v !== value) {
      // @ts-expect-error -- We expect the property to be writable
      repository[name] = value
      core.info(
        `Setting ${name} property to ${value} for ${repository.name} repository`
      )
      config.addResource(repository)
    }
  }
}
