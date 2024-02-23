import {Resource, ResourceConstructors} from '../resources/resource'
import {State} from '../terraform/state'
import {Id} from '../terraform/schema'
import {Config} from '../yaml/config'
import {Member} from '../resources/member'
import {Repository} from '../resources/repository'
import {RepositoryCollaborator} from '../resources/repository-collaborator'
import {RepositoryFile} from '../resources/repository-file'
import {RepositoryTeam} from '../resources/repository-team'
import {RepositoryLabel} from '../resources/repository-label'

export async function normalizaConfig() {
  const state = await State.New()
  const config = Config.FromPath()

  const stateRepositories = state.getResources(Repository)
  const configRepositories = config.getResources(Repository)
  const stateRepositoryCollaborators = state.getResources(
    RepositoryCollaborator
  )
  const stateRepositoryFiles = state.getResources(RepositoryFile)
  const configRepositoryFiles = config.getResources(RepositoryFile)
  const stateRepositoryTeams = state.getResources(RepositoryTeam)
  const stateRepositoryLabels = state.getResources(RepositoryLabel)

  for (const configRepository of configRepositories) {
    if (configRepository.archived) {
      config.removeResource(configRepository)
      const stateRepository = stateRepositories.find(
        r => r.name == configRepository.name
      )
      if (stateRepository) {
        stateRepository.archived = true
        stateRepositoryCollaborators
          .filter(c => c.repository == stateRepository.name)
          .forEach(c => config.addResource(c))
        stateRepositoryFiles
          .filter(f => f.repository == stateRepository.name)
          .forEach(f => config.addResource(f))
        stateRepositoryTeams
          .filter(t => t.repository == stateRepository.name)
          .forEach(t => config.addResource(t))
        stateRepositoryLabels
          .filter(l => l.repository == stateRepository.name)
          .forEach(l => config.addResource(l))
      }
    }
  }

  for (const configRepositoryFile of configRepositoryFiles) {
    const stateRepositoryFile = stateRepositoryFiles.find(
      f =>
        f.repository == configRepositoryFile.repository &&
        f.file == configRepositoryFile.file
    )
    if (stateRepositoryFile) {
      if (configRepositoryFile.content == stateRepositoryFile.content) {
        config.removeResource(configRepositoryFile)
        config.addResource(stateRepositoryFile)
      }
    }
  }

  config.save()
}

normalizaConfig()
