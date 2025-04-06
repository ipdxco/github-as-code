import {GitHub} from '../github'
import {context} from '@actions/github'

async function updatePullRequests(): Promise<void> {
  const github = await GitHub.getGitHub()

  const pulls = await github.client.paginate(github.client.pulls.list, {
    ...context.repo,
    state: 'open'
  })

  for (const pull of pulls) {
    if (pull.draft === true) {
      // skip draft pull requests
      continue
    }

    if (pull.user?.type === 'Bot') {
      // skip bot pull requests
      continue
    }

    // replace process.env.GITHUB_REF_NAME with context.refName if it becomes available https://github.com/actions/toolkit/pull/935
    if (pull.base.ref !== (process.env.GITHUB_REF_NAME as string)) {
      // skip pull requests that are not on the target branch
      continue
    }

    if (pull.base.sha === context.sha) {
      // skip pull requests that are already up to date
      continue
    }

    try {
      await github.client.pulls.updateBranch({
        ...context.repo,
        pull_number: pull.number
      })
    } catch (error) {
      // we might be unable to update the pull request if it there is a conflict
      console.error(error)
    }
  }
}

updatePullRequests()
