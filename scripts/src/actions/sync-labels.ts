import 'reflect-metadata'
import {Octokit} from '@octokit/rest'
import {GitHub} from '../github'
import env from '../env'
import * as core from '@actions/core'
import {GetResponseDataTypeFromEndpointMethod} from '@octokit/types' // eslint-disable-line import/named

const Endpoints = new Octokit()
type Labels = GetResponseDataTypeFromEndpointMethod<
  typeof Endpoints.issues.getLabel
>[]

async function getLabels(repo: string): Promise<Labels> {
  // initialize GitHub client
  const github = await GitHub.getGitHub()

  // use the GitHub client to fetch the list of labels from js-libp2p
  const labels = await github.client.paginate(
    github.client.issues.listLabelsForRepo,
    {
      owner: env.GITHUB_ORG,
      repo: repo
    }
  )

  return labels
}

async function addLabel(
  repo: string,
  name: string,
  color: string,
  description: string | undefined
) {
  // initialize GitHub client
  const github = await GitHub.getGitHub()

  await github.client.issues.createLabel({
    owner: env.GITHUB_ORG,
    repo: repo,
    name: name,
    color: color,
    description: description
  })
}

async function removeLabel(repo: string, name: string) {
  // initialize GitHub client
  const github = await GitHub.getGitHub()

  await github.client.issues.deleteLabel({
    owner: env.GITHUB_ORG,
    repo: repo,
    name: name
  })
}

async function sync() {
  const sourceRepo = process.env.SOURCE_REPOSITORY
  const targetRepos = process.env.TARGET_REPOSITORIES?.split(',')?.map(r =>
    r.trim()
  )

  if (!sourceRepo) {
    throw new Error('SOURCE_REPOSITORY environment variable not set')
  }

  if (!targetRepos) {
    throw new Error('TARGET_REPOSITORIES environment variable not set')
  }

  const sourceLabels = await getLabels(sourceRepo)
  core.info(
    `Found the following labels in ${sourceRepo}: ${sourceLabels
      .map(l => l.name)
      .join(', ')}`
  )

  for (const repo of targetRepos) {
    const targetLabels = await getLabels(repo)
    core.info(
      `Found the following labels in ${repo}: ${targetLabels
        .map(l => l.name)
        .join(', ')}`
    )

    // for each label in the repo, check if it exists in js-libp2p
    for (const label of targetLabels) {
      if (!sourceLabels.find(l => l.name === label.name)) {
        core.info(`Removing ${label.name} label from ${repo} repository`)
        await removeLabel(repo, label.name)
      }
    }

    // for each label in js-libp2p, check if it exists in the repo
    for (const label of sourceLabels) {
      if (!targetLabels.some(l => l.name === label.name)) {
        core.info(`Adding ${label.name} label to ${repo} repository`)
        await addLabel(
          repo,
          label.name,
          label.color,
          label.description || undefined
        )
      }
    }
  }
}

sync()
