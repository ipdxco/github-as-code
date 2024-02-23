import 'reflect-metadata'
import {RepositoryTeam} from '../resources/repository-team'
import {Team} from '../resources/team'
import {Config} from '../yaml/config'
import {Member} from '../resources/member'
import {NodeBase} from 'yaml/dist/nodes/Node'
import {RepositoryCollaborator} from '../resources/repository-collaborator'
import {Resource, ResourceConstructor} from '../resources/resource'
import {Role, TeamMember} from '../resources/team-member'
import {GitHub} from '../github'

function getResources<T extends Resource>(
  config: Config,
  resourceClass: ResourceConstructor<T>
): T[] {
  const schema = config.get()
  return config.getResources(resourceClass).filter(resource => {
    const node = config.document.getIn(
      resource.getSchemaPath(schema),
      true
    ) as NodeBase
    return !node.comment?.includes('KEEP:')
  })
}

/* This function is used to remove inactive members from the config.
 *
 * 1. It ensures that a team called 'Alumni' exists.
 * 2. It removes all 'Alumni' team from all the repositories.
 * 3. It populates 'Alumni' team with organization members who:
 *  a. do not have 'KEEP:' in their inline comment AND
 *  b. have not been added to the organization recently (if passed through NEW_MEMBERS) AND
 *  c. have not performed any activity in the past X months.
 * 4. It removes repository collaborators who:
 *  a. do not have 'KEEP:' in their inline comment AND
 *  b. have not been added to the repository recently (if passed through NEW_REPOSITORY_COLLABORATORS) AND
 *  c. have not performed any activity on the repository they're a collaborator of in the past X months.
 * 5. It removes team members who:
 *  a. do not have 'KEEP:' in their inline comment AND
 *  b. have not been added to the team recently (if passed through NEW_TEAM_MEMBERS) AND
 *  c. have not performed any activity on any repository the team they're a member of has access to in the past X months.
 * 6. It removes teams which:
 *  a. do not have 'KEEP:' in their inline comment AND
 *  b. do not have members anymore.
 */
async function run(): Promise<void> {
  const newMembers = JSON.parse(process.env.NEW_MEMBERS || '[]')
  const newRepositoryCollaborators = JSON.parse(
    process.env.NEW_REPOSITORY_COLLABORATORS || '{}'
  )
  const newTeamMembers = JSON.parse(process.env.NEW_TEAM_MEMBERS || '{}')

  const github = await GitHub.getGitHub()

  const githubRepositories = await github.listRepositories()

  const since = new Date()
  since.setMonth(since.getMonth() - 12)

  const githubRepositoryActivities =
    await github.listRepositoryActivities(since)
  const githubRepositoryPullRequests =
    await github.listRepositoryPullRequests(since)
  const githubRepositoryIssues = await github.listRepositoryIssues(since)
  const githubRepositoryPullRequestReviewComments =
    await github.listRepositoryPullRequestReviewComments(since)
  const githubRepositoryIssueComments =
    await github.listRepositoryIssueComments(since)
  const githubRepositoryCommitComments =
    await github.listRepositoryCommitComments(since)

  const activeActorsByRepository = [
    ...githubRepositoryActivities.map(({repository, activity}) => ({
      repository: repository.name,
      actor: activity.actor?.login
    })),
    ...githubRepositoryPullRequests.map(({repository, pullRequest}) => ({
      repository: repository.name,
      actor: pullRequest.user?.login
    })),
    ...githubRepositoryIssues.map(({repository, issue}) => ({
      repository: repository.name,
      actor: issue.user?.login
    })),
    ...githubRepositoryPullRequestReviewComments.map(
      ({repository, comment}) => ({
        repository: repository.name,
        actor: comment.user?.login
      })
    ),
    ...githubRepositoryIssueComments.map(({repository, comment}) => ({
      repository: repository.name,
      actor: comment.user?.login
    })),
    ...githubRepositoryCommitComments.map(({repository, comment}) => ({
      repository: repository.name,
      actor: comment.user?.login
    }))
  ]
    .filter(({actor}) => actor)
    .reduce<any>((acc, {repository, actor}) => {
      acc[repository] = acc[repository] ?? []
      acc[repository].push(actor)
      return acc
    }, {})
  const activeActors = Array.from(
    new Set(Object.values(activeActorsByRepository).flat())
  )
  const archivedRepositories = githubRepositories
    .filter(repository => repository.archived)
    .map(repository => repository.name)

  const config = Config.FromPath()

  // alumni is a team for all the members who should get credit for their work
  //  but do not need any special access anymore
  // first, ensure that the team exists
  const alumniTeam = new Team('Alumni')
  config.addResource(alumniTeam)

  // then, ensure that the team doesn't have any special access anywhere
  const repositoryTeams = config.getResources(RepositoryTeam)
  for (const repositoryTeam of repositoryTeams) {
    if (repositoryTeam.team === alumniTeam.name) {
      config.removeResource(repositoryTeam)
    }
  }

  // add members that have been inactive to the alumni team
  const members = getResources(config, Member)
  for (const member of members) {
    const isNew = newMembers.includes(member.username)
    if (!isNew) {
      const isActive = activeActors.includes(member.username)
      if (!isActive) {
        console.log(`Adding ${member.username} to the ${alumniTeam.name} team`)
        const teamMember = new TeamMember(
          alumniTeam.name,
          member.username,
          Role.Member
        )
        config.addResource(teamMember)
      }
    }
  }

  // remove repository collaborators that have been inactive
  const repositoryCollaborators = getResources(config, RepositoryCollaborator)
  for (const repositoryCollaborator of repositoryCollaborators) {
    const isNew = newRepositoryCollaborators[
      repositoryCollaborator.username
    ]?.includes(repositoryCollaborator.repository)
    if (!isNew) {
      const isCollaboratorActive = activeActorsByRepository[
        repositoryCollaborator.repository
      ]?.includes(repositoryCollaborator.username)
      const isRepositoryArchived = archivedRepositories.includes(
        repositoryCollaborator.repository
      )
      if (!isCollaboratorActive && !isRepositoryArchived) {
        console.log(
          `Removing ${repositoryCollaborator.username} from ${repositoryCollaborator.repository} repository`
        )
        config.removeResource(repositoryCollaborator)
      }
    }
  }

  // remove team members that have been inactive (look at all the team repositories)
  const teamMembers = getResources(config, TeamMember).filter(
    teamMember => teamMember.team !== alumniTeam.name
  )
  for (const teamMember of teamMembers) {
    const isNew = newTeamMembers[teamMember.username]?.includes(teamMember.team)
    if (!isNew) {
      const repositories = repositoryTeams
        .filter(repositoryTeam => repositoryTeam.team === teamMember.team)
        .map(repositoryTeam => repositoryTeam.repository)
      const isActive = repositories.some(repository =>
        activeActorsByRepository[repository]?.includes(teamMember.username)
      )
      if (!isActive) {
        console.log(
          `Removing ${teamMember.username} from ${teamMember.team} team`
        )
        config.removeResource(teamMember)
      }
    }
  }

  // remove teams that have no members
  const teams = getResources(config, Team)
  const teamMembersAfterRemoval = config.getResources(TeamMember)
  for (const team of teams) {
    const hasMembers = teamMembersAfterRemoval.some(
      teamMember => teamMember.team === team.name
    )
    if (!hasMembers) {
      console.log(`Removing ${team.name} team`)
      config.removeResource(team)
    }
  }

  config.save()
}

run()
