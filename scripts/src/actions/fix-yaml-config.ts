import 'reflect-metadata'

import {runToggleArchivedRepos} from './shared/toggle-archived-repos'
import {runDescribeAccessChanges} from './shared/describe-access-changes'

import * as core from '@actions/core'

async function run(): Promise<void> {
  await runToggleArchivedRepos()

  const accessChangesDescription = await runDescribeAccessChanges()

  core.setOutput(
    'comment',
    `The following access changes will be introduced as a result of applying the plan:

<details><summary>Access Changes</summary>

\`\`\`
${accessChangesDescription}
\`\`\`

</details>`
  )
}

run()
