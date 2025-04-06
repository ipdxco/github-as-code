import {Config} from '../../yaml/config'
import {Repository, Visibility} from '../../resources/repository'
import {RepositoryBranchProtectionRule} from '../../resources/repository-branch-protection-rule'

export async function protectDefaultBranches(
  includePrivate = false
): Promise<void> {
  const config = Config.FromPath()

  const repositories = config.getResources(Repository).filter(r => !r.archived)

  for (const repository of repositories) {
    if (includePrivate || repository.visibility !== Visibility.Private) {
      const rule = new RepositoryBranchProtectionRule(
        repository.name,
        repository.default_branch ?? 'main'
      )
      if (!config.someResource(rule)) {
        console.log(
          `Adding branch protection rule for ${rule.pattern} to ${rule.repository} repository`
        )
        config.addResource(rule)
      }
    }
  }

  config.save()
}
