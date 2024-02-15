import 'reflect-metadata'

import { toggleArchivedRepos } from './shared/toggle-archived-repos'

async function run(): Promise<void> {
  await toggleArchivedRepos()
}

run()
