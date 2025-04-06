import 'reflect-metadata'
import {Octokit} from '@octokit/rest'
import {GitHub} from '../github'
import env from '../env'
import * as core from '@actions/core'
import type {GetResponseDataTypeFromEndpointMethod} from '@octokit/types'

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
      repo
    }
  )

  return labels
}

async function addLabel(
  repo: string,
  name: string,
  color: string,
  description: string | undefined
): Promise<void> {
  // initialize GitHub client
  const github = await GitHub.getGitHub()

  await github.client.issues.createLabel({
    owner: env.GITHUB_ORG,
    repo,
    name,
    color,
    description
  })
}

async function removeLabel(repo: string, name: string): Promise<void> {
  // initialize GitHub client
  const github = await GitHub.getGitHub()

  await github.client.issues.deleteLabel({
    owner: env.GITHUB_ORG,
    repo,
    name
  })
}

async function sync(): Promise<void> {
  const sourceRepo = process.env.SOURCE_REPOSITORY
  const targetRepos = process.env.TARGET_REPOSITORIES?.split(',')?.map(r =>
    r.trim()
  )
  const addLabels = process.env.ADD_LABELS === 'true'
  const removeLabels = process.env.REMOVE_LABELS === 'true'

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

    if (removeLabels) {
      for (const label of targetLabels) {
        if (!sourceLabels.find(l => l.name === label.name)) {
          core.info(`Removing ${label.name} label from ${repo} repository`)
          await removeLabel(repo, label.name)
        }
      }
    }

    if (addLabels) {
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
}

sync()
