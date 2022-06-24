import fs from 'fs';
import glob from '@actions/glob';
import crypto from 'crypto';

function hash(value) {
  return crypto.createHash('md5').update(value).digest("hex");
}

const root = fs.realpathSync(`${process.cwd()}/..`);
const globber = await glob.create(`${root}/files/**/*`, { matchDirectories: false });
const paths = await globber.glob();
const pathsByHash = Object.fromEntries(paths.map(path => {
  return [hash(fs.readFileSync(path)), path.substring(`${root}/files/`.length)];
}));

export const Resources = {
  github_membership: {
    getPathToAllTheResources: () => { return ['members', '(admin|member)', '.+']; },
    getPathToTheResource: (resourceFromTerraformState) => {
      return ['members', resourceFromTerraformState.values.role, resourceFromTerraformState.values.username];
    },
    getIgnoredProperties: () => {
      return [
        'etag',
        'id'
      ]
    },
    getIndex: (resourceFromConfig) => {
      return resourceFromConfig.value;
    }
  },
  github_repository: {
    getPathToAllTheResources: () => { return ['repositories', '.+']; },
    getPathToTheResource: (resourceFromTerraformState) => {
      const resource = {...resourceFromTerraformState.values};
      resource.pages = resource.pages[0] ? {
        cname: resource.pages[0].cname,
        source: resource.pages[0].source[0]
      } : null;
      resource.template = resource.template[0] || null;
      return ['repositories', { [resourceFromTerraformState.values.name]: resource }];
    },
    getIgnoredProperties: () => {
      return [
        'branches',
        'default_branch',
        'etag',
        'full_name',
        'git_clone_url',
        'html_url',
        'http_clone_url',
        'id',
        'node_id',
        'private',
        'repo_id',
        'ssh_clone_url',
        'svn_url',
        'name'
      ]
    },
    getIndex: (resourceFromConfig) => {
      return resourceFromConfig.key.value;
    }
  },
  github_repository_collaborator: {
    getPathToAllTheResources: () => { return ['repositories', '.+', 'collaborators', '(admin|maintain|push|triage|pull)', '.+']; },
    getPathToTheResource: (resourceFromTerraformState) => {
      return ['repositories', resourceFromTerraformState.values.repository, 'collaborators', resourceFromTerraformState.values.permission, resourceFromTerraformState.values.username];
    },
    getIgnoredProperties: () => {
      return [
        'id',
        'invitation_id',
        'permission_diff_suppression'
      ]
    },
    getIndex: (resourceFromConfig) => {
      return `${resourceFromConfig.path[1]}:${resourceFromConfig.value}`;
    }
  },
  github_branch_protection: {
    getPathToAllTheResources: () => { return ['repositories', '.+', 'branch_protection', '.+']; },
    getPathToTheResource: (resourceFromTerraformState, terraformDataResources) => {
      const repositoryName = terraformDataResources.filter(resource => {
        return resource.address.startsWith("data.github_repository.this");
      }).find(resource => {
        return resource.values.node_id == resourceFromTerraformState.values.repository_id;
      }).values.name;
      const resource = {...resourceFromTerraformState.values};
      resource.required_pull_request_reviews = resource.required_pull_request_reviews[0] || null;
      resource.required_status_checks = resource.required_status_checks[0] || null;
      return ['repositories', repositoryName, 'branch_protection', { [resourceFromTerraformState.values.pattern]: resource }];
    },
    getIgnoredProperties: () => {
      return [
        'pattern',
        'repository_id',
        'id'
      ]
    },
    getIndex: (resourceFromConfig) => {
      return `${resourceFromConfig.path[1]}:${resourceFromConfig.key.value}`;
    }
  },
  github_team: {
    getPathToAllTheResources: () => { return ['teams', '.+']; },
    getPathToTheResource: (resourceFromTerraformState, terraformDataResources) => {
      const resource = {...resourceFromTerraformState.values}
      if (resource.parent_team_id) {
        resource.parent_team_id = terraformDataResources.find(resource => {
          return resource.address == "data.github_organization_teams.this";
        }).values.teams.find(team => {
          return team.id == resource.parent_team_id;
        }).name;
      }
      return ['teams', { [resourceFromTerraformState.values.name]: resource }];
    },
    getIgnoredProperties: () => {
      return [
        'create_default_maintainer',
        'etag',
        'id',
        'ldap_dn',
        'members_count',
        'node_id',
        'name',
        'slug'
      ];
    },
    getIndex: (resourceFromConfig) => {
      return resourceFromConfig.key.value;
    }
  },
  github_team_repository: {
    getPathToAllTheResources: () => { return ['repositories', '.+', 'teams', '(admin|maintain|push|triage|pull)', '.+']; },
    getPathToTheResource: (resourceFromTerraformState, terraformDataResources) => {
      const teamName = terraformDataResources.find(resource => {
        return resource.address == "data.github_organization_teams.this";
      }).values.teams.find(team => {
        return team.id == resourceFromTerraformState.values.team_id;
      }).name;
      return ['repositories', resourceFromTerraformState.values.repository, 'teams', resourceFromTerraformState.values.permission, teamName];
    },
    getIgnoredProperties: () => {
      return [
        'etag',
        'id'
      ]
    },
    getIndex: (resourceFromConfig) => {
      return `${resourceFromConfig.value}:${resourceFromConfig.path[1]}`;
    }
  },
  github_team_membership: {
    getPathToAllTheResources: () => { return ['teams', '.+', 'members', '(maintainer|member)', '.+']; },
    getPathToTheResource: (resourceFromTerraformState, terraformDataResources) => {
      const teamName = terraformDataResources.find(resource => {
        return resource.address == "data.github_organization_teams.this";
      }).values.teams.find(team => {
        return team.id == resourceFromTerraformState.values.team_id;
      }).name;
      return ['teams', teamName, 'members', resourceFromTerraformState.values.role, resourceFromTerraformState.values.username];
    },
    getIgnoredProperties: () => {
      return [
        'etag',
        'id'
      ]
    },
    getIndex: (resourceFromConfig) => {
      return `${resourceFromConfig.path[1]}:${resourceFromConfig.value}`;
    }
  },
  github_repository_file: {
    getPathToAllTheResources: () => { return ['repositories', '.+', 'files', '.+']; },
    getPathToTheResource: (resourceFromTerraformState) => {
      const resource = {...resourceFromTerraformState.values}
      resource.content = pathsByHash[hash(resource.content)] || resource.content;
      return ['repositories', resourceFromTerraformState.values.repository, 'files', { [resourceFromTerraformState.values.file]: resource }];
    },
    getIgnoredProperties: () => {
      return [
        'commit_sha',
        'file',
        'id',
        'repository',
        'sha'
      ]
    },
    getIndex: (resourceFromConfig) => {
      return `${resourceFromConfig.path[1]}/${resourceFromConfig.key.value}`;
    }
  }
}
