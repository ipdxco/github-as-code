import 'reflect-metadata'
import { RepositoryTeam } from '../resources/repository-team'
import { Team } from '../resources/team'
import {Config} from '../yaml/config'
import * as fs from 'fs'
import { Member } from '../resources/member'
import { NodeBase } from 'yaml/dist/nodes/Node'
import { RepositoryCollaborator } from '../resources/repository-collaborator'
import { Resource, ResourceConstructor } from '../resources/resource'
import { Role, TeamMember } from '../resources/team-member'

const AUDIT_LOG_IGNORED_EVENT_CATEGORIES = [
  'org_credential_authorization'
]
const AUDIT_LOG_LENGTH_IN_MONTHS = 12

function getResources<T extends Resource>(config: Config, resourceClass: ResourceConstructor<T>): T[] {
  const schema = config.get()
  return config.getResources(resourceClass).filter(resource => {
    const node = config.document.getIn(resource.getSchemaPath(schema), true) as NodeBase
    return ! node.comment?.includes('KEEP:')
  })
}

async function run(): Promise<void> {
  if (! process.env.LOG_PATH) {
    throw new Error('LOG_PATH environment variable is not set')
  }

  const logStartDate = new Date();
  logStartDate.setMonth(logStartDate.getMonth() - AUDIT_LOG_LENGTH_IN_MONTHS);

  const log = JSON.parse(fs.readFileSync(process.env.LOG_PATH).toString()).filter((event: any) => {
    return new Date(event.created_at) >= logStartDate && !AUDIT_LOG_IGNORED_EVENT_CATEGORIES.includes(event.action.split('.')[0])
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
    const isActive = log.some((event: any) => event.actor === member.username)
    if (! isActive) {
      const teamMember = new TeamMember(alumniTeam.name, member.username, Role.Member)
      config.addResource(teamMember)
    }
  }

  // remove repository collaborators that have been inactive
  const repositoryCollaborators = config.getResources(RepositoryCollaborator)
  for (const repositoryCollaborator of repositoryCollaborators) {
    const isActive = log.some((event: any) => event.actor === repositoryCollaborator.username && event.repo.split('/')[1] === repositoryCollaborator.repository)
    if (! isActive) {
      config.removeResource(repositoryCollaborator)
    }
  }

  // remove team members that have been inactive (look at all the team repositories)
  const teamMembers = config.getResources(TeamMember).filter(teamMember => teamMember.team !== alumniTeam.name)
  for (const teamMember of teamMembers) {
    const repositories = repositoryTeams.filter(repositoryTeam => repositoryTeam.team === teamMember.team).map(repositoryTeam => repositoryTeam.repository)
    const isActive = log.some((event: any) => event.actor === teamMember.username && repositories.includes(event.repo.split('/')[1]))
    if (! isActive) {
      config.removeResource(teamMember)
    }
  }

  // remove teams that have no members
  const teams = config.getResources(Team)
  const teamMembersAfterRemoval = config.getResources(TeamMember)
  for (const team of teams) {
    const hasMembers = teamMembersAfterRemoval.some(teamMember => teamMember.team === team.name)
    if (! hasMembers) {
      config.removeResource(team)
    }
  }

  config.save()
}

run()
