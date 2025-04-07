import {Config} from '../../yaml/config'
import {Repository} from '../../resources/repository'
import {State} from '../../terraform/state'

export async function runToggleArchivedRepos(): Promise<void> {
  const state = await State.New()
  const config = Config.FromPath()

  await toggleArchivedRepos(state, config)

  config.save()
}

export async function toggleArchivedRepos(
  state: State,
  config: Config
): Promise<void> {
  const resources = state.getAllResources()
  const stateRepositories = state.getResources(Repository)
  const configRepositories = config.getResources(Repository)

  for (const configRepository of configRepositories) {
    if (configRepository.archived) {
      config.removeResource(configRepository)
      const repository = new Repository(configRepository.name)
      repository.archived = true
      config.addResource(repository)
    } else {
      const stateRepository = stateRepositories.find(
        r => r.name === configRepository.name
      )
      if (stateRepository !== undefined && stateRepository.archived) {
        stateRepository.archived = false
        config.addResource(stateRepository)
        for (const resource of resources) {
          if (
            'repository' in resource &&
            (resource as any).repository === stateRepository.name
          ) {
            config.addResource(resource)
          }
        }
      }
    }
  }
}
