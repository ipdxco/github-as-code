import 'reflect-metadata'
import {sync} from './sync'
import {State} from './terraform/state'
import {Config} from './yaml/config'
import {toggleArchivedRepos} from './actions/shared/toggle-archived-repos'

async function runSync(): Promise<void> {
  const state = await State.New()
  const config = Config.FromPath()

  await sync(state, config)

  config.save()
}

async function runToggleArchivedRepos(): Promise<void> {
  const config = Config.FromPath()

  await toggleArchivedRepos(config)

  config.save()
}

async function run(): Promise<void> {
  await runSync()
  await runToggleArchivedRepos()
}

run()
