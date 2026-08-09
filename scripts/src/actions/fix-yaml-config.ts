import 'reflect-metadata'

import {runToggleArchivedRepos} from './shared/toggle-archived-repos.js'
import {runDescribeAccessChanges} from './shared/describe-access-changes.js'

import * as core from '@actions/core'

async function run(): Promise<void> {
  await runToggleArchivedRepos()

  const accessChangesComment = await runDescribeAccessChanges()

  core.setOutput('comment', accessChangesComment)
}

run()
