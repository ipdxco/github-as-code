import 'reflect-metadata'
import {runSync} from './sync'
import {runToggleArchivedRepos} from './actions/shared/toggle-archived-repos'

async function run(): Promise<void> {
  await runSync()
  await runToggleArchivedRepos()
}

run()
