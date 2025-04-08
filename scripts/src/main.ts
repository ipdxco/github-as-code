import 'reflect-metadata'
import {runSync} from './sync.js'
import {runToggleArchivedRepos} from './actions/shared/toggle-archived-repos.js'

async function run(): Promise<void> {
  await runSync()
  await runToggleArchivedRepos()
}

run()
