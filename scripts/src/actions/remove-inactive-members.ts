import 'reflect-metadata'
import {RepositoryTeam} from '../resources/repository-team'
import {Team} from '../resources/team'
import {Config} from '../yaml/config'
import * as fs from 'fs'
import {Member} from '../resources/member'
import {NodeBase} from 'yaml/dist/nodes/Node'
import {RepositoryCollaborator} from '../resources/repository-collaborator'
import {Resource, ResourceConstructor} from '../resources/resource'
import {Role, TeamMember} from '../resources/team-member'
import {GitHub} from '../github'

const AUDIT_LOG_IGNORED_EVENT_CATEGORIES = ['org_credential_authorization']
const AUDIT_LOG_LENGTH_IN_MONTHS = 12

function stripOrgPrefix(repoOrTeam: string): string {
  return repoOrTeam.split('/').slice(1).join('/') // org/repo => repo
}

function getRepositories(event: any): string[] {
  // event.repo is either an array of org/repo strings, a single org/repo string, or null
  return (
    Array.isArray(event.repo ?? []) ? event.repo ?? [] : [event.repo]
  ).map(stripOrgPrefix)
}

function getResources<T extends Resource>(
  config: Config,
  resourceClass: ResourceConstructor<T>
): T[] {
  const schema = config.get()
  return config.getResources(resourceClass).filter(resource => {
    const node = config.document.getIn(
      resource.getSchemaPath(schema).get(),
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
 *  b. have not been added to the organization in the past 12 months AND
 *  c. have not performed any audit log activity in the past 12 months.
 * 4. It removes repository collaborators who:
 *  a. do not have 'KEEP:' in their inline comment AND
 *  b. have not been added to the repository in the past 12 months AND
 *  c. have not performed any audit log activity on the repository they're a collaborator of in the past 12 months.
 * 5. It removes team members who:
 *  a. do not have 'KEEP:' in their inline comment AND
 *  b. have not been added to the team in the past 12 months AND
 *  c. have not performed any audit log activity on any repository the team they're a member of has access to in the past 12 months.
 * 6. It removes teams which:
 *  a. do not have 'KEEP:' in their inline comment AND
 *  b. do not have members anymore.
 */
async function run(): Promise<void> {
  if (!process.env.LOG_PATH) {
    throw new Error(
      'LOG_PATH environment variable is not set. It should point to the path of the JSON audit log. You can download it by following these instructions: https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization'
    )
  }

  const github = await GitHub.getGitHub()

  const archivedRepositories = (await github.listRepositories())
    .filter(repository => repository.archived)
    .map(repository => repository.name)
  const teamSlugsByName = (await github.listTeams()).reduce(
    (map: Record<string, string>, team) => {
      map[team.name] = team.slug
      return map
    },
    {}
  )

  const logStartDate = new Date()
  logStartDate.setMonth(logStartDate.getMonth() - AUDIT_LOG_LENGTH_IN_MONTHS)

  const log = JSON.parse(
    fs.readFileSync(process.env.LOG_PATH).toString()
  ).filter((event: any) => {
    return (
      new Date(event.created_at) >= logStartDate &&
      !AUDIT_LOG_IGNORED_EVENT_CATEGORIES.includes(event.action.split('.')[0])
    )
  })
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
    const isNew = log.some(
      (event: any) =>
        event.action === 'org.add_member' && event.user === member.username
    )
    if (!isNew) {
      const isActive = log.some((event: any) => event.actor === member.username)
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
    const isNew = log.some(
      (event: any) =>
        event.action === 'repo.add_member' &&
        event.user === repositoryCollaborator.username &&
        stripOrgPrefix(event.repo) === repositoryCollaborator.repository
    )
    if (!isNew) {
      const isCollaboratorActive = log.some(
        (event: any) =>
          event.actor === repositoryCollaborator.username &&
          getRepositories(event).includes(repositoryCollaborator.repository)
      )
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
    const isNew = log.some(
      (event: any) =>
        event.action === 'team.add_member' &&
        event.user === teamMember.username &&
        stripOrgPrefix(event.data.team) === teamSlugsByName[teamMember.team]
    )
    if (!isNew) {
      const repositories = repositoryTeams
        .filter(repositoryTeam => repositoryTeam.team === teamMember.team)
        .map(repositoryTeam => repositoryTeam.repository)
      const isActive = log.some(
        (event: any) =>
          event.actor === teamMember.username &&
          getRepositories(event).some(repository =>
            repositories.includes(repository)
          )
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
