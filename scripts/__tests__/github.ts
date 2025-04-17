import {mock} from 'node:test'

export interface GitHubConfig {
  repositories?: {
    name: string
    collaborators?: {
      login: string
    }[]
    branchProtectionRules?: {
      pattern: string
    }[]
    invitations?: {
      login: string
    }[]
    labels?: {
      name: string
    }[]
  }[]
  teams?: {
    name: string
    members?: {
      login: string
    }[]
    invitations?: {
      login: string
    }[]
    repositories?: {
      name: string
    }[]
  }[]
  invitations?: {
    login: string
  }[]
  members?: {
    login: string
  }[]
}

export function mockGitHub(config: GitHubConfig = {}): void {
  mock.module('@octokit/auth-app', {
    namedExports: {
      createAppAuth: () => () => ({token: undefined})
    }
  })

  mock.module('@octokit/rest', {
    namedExports: {
      Octokit: {
        plugin: () => {
          // return Constructor of Octokit-like object
          return class {
            issues = {
              listCommentsForRepo: async () => [],
              listForRepo: async () => [],
              listLabelsForRepo: async (opts: {repo: string}) =>
                config?.repositories?.find(r => r.name === opts.repo)?.labels ??
                []
            }
            orgs = {
              getMembershipForUser: async () => ({
                data: {}
              }),
              listMembers: async () => config?.members ?? [],
              listPendingInvitations: async () => config?.invitations ?? []
            }
            pulls = {
              listReviewCommentsForRepo: async () => []
            }
            repos = {
              get: async (opts: {owner: string; repo: string}) => ({
                data: {
                  owner: {
                    login: opts.owner
                  },
                  name: opts.repo,
                  default_branch: 'main'
                }
              }),
              getContent: async (opts: {
                owner: string
                repo: string
                path: string
                ref: string
              }) => ({
                data: {
                  path: opts.path,
                  url: `https://github.com/${opts.owner}/${opts.repo}/blob/${opts.ref}/${opts.path}`,
                  ref: opts.ref
                }
              }),
              listActivities: async () => [],
              listCollaborators: async (opts: {repo: string}) =>
                config?.repositories?.find(r => r.name === opts.repo)
                  ?.collaborators ?? [],
              listCommitCommentsForRepo: async () => [],
              listForOrg: async () => config?.repositories ?? [],
              listInvitations: async (opts: {repo: string}) => {
                const repository = config?.repositories?.find(
                  r => r.name === opts.repo
                )

                return repository?.invitations?.map(invitee => ({
                  repository,
                  invitee
                }))
              }
            }
            teams = {
              getMembershipForUserInOrg: async () => ({
                data: {}
              }),
              list: async () =>
                config?.teams?.map(t => ({slug: t.name, ...t})) ?? [],
              listMembersInOrg: async (opts: {team_slug: string}) =>
                config?.teams?.find(t => t.name === opts.team_slug)?.members ??
                [],
              listPendingInvitationsInOrg: async (opts: {team_slug: string}) =>
                config?.teams?.find(t => t.name === opts.team_slug)
                  ?.invitations ?? [],
              listReposInOrg: async (opts: {team_slug: string}) =>
                config?.teams?.find(t => t.name === opts.team_slug)
                  ?.repositories ?? []
            }
            async paginate<T, K>(
              f: (opts: K) => Promise<T>,
              opts: K
            ): Promise<T> {
              return f(opts)
            }
            async graphql(query: string): Promise<unknown> {
              // extract owner and repo from query using repository\(owner: \"([^\"]+)\", name: \"([^\"]+)\"\)
              const match = query.match(
                /repository\(owner: "([^"]+)", name: "([^"]+)"\)/
              )
              if (match === null) {
                throw new Error(`Could not find repository in query: ${query}`)
              }
              const [, , repo] = match
              const nodes =
                config.repositories?.find(r => r.name === repo)
                  ?.branchProtectionRules ?? []
              return {
                repository: {
                  branchProtectionRules: {
                    nodes
                  }
                }
              }
            }
          }
        }
      }
    }
  })
}
