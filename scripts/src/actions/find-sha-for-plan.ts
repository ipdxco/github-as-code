import {GitHub} from '../github.js'
import {context} from '@actions/github'
import * as core from '@actions/core'

async function findShaForPlan(): Promise<string> {
  const github = await GitHub.getGitHub()

  if (context.eventName !== 'push') {
    console.log(
      `This is not a push event ("${context.eventName}"); returning "${context.sha}"`
    )
    return context.sha
  }

  const q = `repo:${context.repo.owner}/${context.repo.repo} ${context.sha} type:pr is:merged`
  console.log(`Running advanced query: ${q}`)
  const pulls = await github.client.paginate(
    github.client.search.issuesAndPullRequests,
    {
      q,
      advanced_search: 'true'
    }
  )

  if (pulls.length === 0) {
    console.log('Got 0 pull request, returning empty string')
    return ''
  }

  const pull = pulls[0]
  console.log(`Processing pull request number ${pull.number}`)
  const commits = await github.client.paginate(
    github.client.pulls.listCommits,
    {
      ...context.repo,
      pull_number: pull.number
    }
  )

  if (commits.length === 0) {
    console.log('Found 0 commits, returning empty string')
    return ''
  }

  const commit = commits[commits.length - 1]
  console.log(`Returning commit ${commit.sha}`)
  return commits[commits.length - 1].sha
}

async function run(): Promise<void> {
  const sha = await findShaForPlan()
  core.setOutput('result', sha)
}

run()
