import 'reflect-metadata'

import { toggleArchivedRepos } from './shared/toggle-archived-repos'
import { describeAccessChanges } from './shared/describe-access-changes'

import * as core from '@actions/core'

async function run(): Promise<void> {
  await toggleArchivedRepos()

  const accessChangesDescription = await describeAccessChanges()

  core.setOutput('comment', `The following access changes will be introduced as a result of applying the plan:

<details><summary>Access Changes</summary>

\`\`\`
${accessChangesDescription}
\`\`\`

</details>`)
}

run()
