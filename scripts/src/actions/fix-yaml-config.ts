import 'reflect-metadata'

import { toggleArchivedRepos } from './shared/toggle-archived-repos'
import { getAccessSummaryDescription } from './shared/get-access-summary-description'

import * as core from '@actions/core'

async function run(): Promise<void> {
  await toggleArchivedRepos()

  const accessSummaryDescription = await getAccessSummaryDescription()

  core.setOutput('comment', accessSummaryDescription)
}

run()
