import {GitHub} from '../github'
import {context} from '@actions/github'
import * as core from '@actions/core'

async function findShaForPlan() {
  const github = await GitHub.getGitHub()

  if (context.eventName !== 'push') {
    return context.sha
  }

  const pulls = await github.client.paginate(
    github.client.search.issuesAndPullRequests,
    {
      q: `repository:${context.repo.owner}/${context.repo.repo} ${context.sha} type:pr is:merged`
    }
  )

  if (pulls.length === 0) {
    return ''
  }

  const pull = pulls[0]
  const commits = await github.client.paginate(
    github.client.pulls.listCommits,
    {
      ...context.repo,
      pull_number: pull.number
    }
  )

  if (commits.length === 0) {
    return ''
  }

  return commits[commits.length - 1].sha
}

findShaForPlan().then(sha => {
  core.setOutput('result', sha)
})
