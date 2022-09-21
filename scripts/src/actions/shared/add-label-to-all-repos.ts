import {Config} from '../../yaml/config'
import {Repository} from '../../resources/repository'
import {GitHub} from '../../github'
import env from '../../env'
import * as core from '@actions/core'

export async function addLabelToAllRepos(
  label: string,
  color: string,
  description: string,
  repositoryFilter: (repository: Repository) => boolean = () => true
): Promise<void> {
  const config = Config.FromPath()
  const github = await GitHub.getGitHub()

  const repositories = config
    .getResources(Repository)
    .filter(r => !r.archived)
    .filter(repositoryFilter)

  for (const repository of repositories) {
    // labels are not supported by GitHub Management yet
    const labels = await github.client.paginate(
      github.client.issues.listLabelsForRepo,
      {
        owner: env.GITHUB_ORG,
        repo: repository.name
      }
    )
    if (!labels.map(l => l.name).includes(label)) {
      core.info(`Adding label ${label} to ${repository.name}`)
      await github.client.issues.createLabel({
        owner: env.GITHUB_ORG,
        repo: repository.name,
        name: label,
        color: color,
        description: description
      })
    }
  }
}
