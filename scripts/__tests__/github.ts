import {mock} from 'node:test'

export function mockGitHub(): void {
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
              listLabelsForRepo: async () => []
            }
            orgs = {
              getMembershipForUser: async () => {},
              listInvitationTeams: async () => [],
              listMembers: async () => [],
              listPendingInvitations: async () => []
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
              listCollaborators: async () => [],
              listCommitCommentsForRepo: async () => [],
              listForOrg: async () => [],
              listInvitations: async () => []
            }
            teams = {
              getMembershipForUserInOrg: async () => {},
              list: async () => [],
              listMembersInOrg: async () => [],
              listPendingInvitationsInOrg: async () => [],
              listReposInOrg: async () => []
            }
            async paginate<T, K>(
              f: (opts: K) => Promise<T>,
              opts: K
            ): Promise<T> {
              return f(opts)
            }
          }
        }
      }
    }
  })
}
