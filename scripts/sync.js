import fs from 'fs';
import HCL from 'hcl2-parser';
import cli from '@actions/exec';
import glob from '@actions/glob';

const __dirname = process.cwd();
const __rootdirname = fs.realpathSync(`${__dirname}/..`);

const resourceToData = {
  "github_membership": ["github_organization"],
  "github_repository": ["github_repositories"],
  "github_repository_collaborator": ["github_collaborators"],
  "github_branch_protection": ["github_repository"],
  "github_team": ["github_organization_teams"],
  "github_team_repository": ["github_organization_teams"],
  "github_team_membership": ["github_organization_teams"],
  "github_repository_file": ["github_tree"]
}

const resourceToKeys = {
  "github_membership": ["username"],
  "github_repository": ["name"],
  "github_repository_collaborator": ["repository", "username"],
  "github_branch_protection": ["pattern", "repository_id"],
  "github_team": ["name"],
  "github_team_repository": ["repository", "team_id"],
  "github_team_membership": ["team_id", "username"],
  "github_repository_file": ["repository", "file"]
}

function getResourcesByAddressPrefix(state, addressPrefix) {
  let modules = [state?.values?.root_module]
  modules = modules.concat(state?.values?.root_module?.child_modules || []);
  const resources = modules.flatMap(module => { return module.resources; });
  return resources.filter(resource => { return resource.address.startsWith(addressPrefix); });
}

const terraform = {
  getStateJSON: async () => {
    let content = '';
    await cli.exec('terraform show -json', null, {
      cwd: `${__rootdirname}/terraform`,
      listeners: { stdout: data => { content += data.toString(); } },
      silent: true
    });
    return JSON.parse(content);
  },
  getOutputJSON: async () => {
    let content = '';
    await cli.exec('terraform output -json', null, {
      cwd: `${__rootdirname}/terraform`,
      listeners: { stdout: data => { content += data.toString(); } },
      silent: true
    });
    return JSON.parse(content);
  }
}

async function main() {
  const lock = process.env.TF_LOCK != 'false';

  let organization = ''
  cli.exec('terraform workspace show', null, {
    cwd: `${__rootdirname}/terraform`,
    listeners: { stdout: data => { content += data.toString(); } }
  })
  organization = organization.trim();

  const localsContent = fs.readFileSync(`${__rootdirname}/terraform/locals.tf`);
  const resourcesContent = fs.readFileSync(`${__rootdirname}/terraform/resources.tf`);
  const resourcesOverrideContent = fs.readFileSync(`${__rootdirname}/terraform/resources_override.tf`);

  const localsTF = HCL.parseToObject(localsContent).locals;
  const resourcesTF = HCL.parseToObject(resourcesContent)[0].resource;
  const resourcesOverrideTF = HCL.parseToObject(resourcesOverrideContent)[0].resource;

  const resources = fs.readdirSync(`${__rootdirname}/github/${organization}/`).map(path => {
    return path.substring(0, path.length - 5);
  });

  const resourceTargetsString = resources.map(resource => {
    return `-target=github_${resource}.this`;
  }).join(' ');
  const dataTargetsString = resources.flatmap(resource => {
    return resourceToData[resource];
  }).map(data => {
    return `-target=data.${data}.this`
  }).join(' ');

  cli.exec(`terraform refresh ${resourceTargetsString} -lock=${lock}`, null, { cwd: `${__rootdirname}/terraform` });
  cli.exec(`terraform apply ${dataTargetsString} -auto-approve -lock=${lock}`, null, { cwd: `${__rootdirname}/terraform` });

  let state = await terraform.getStateJSON();
  let output = await terraform.getOutputJSON();

  for (const resource of resources) {
    const stateResources = getResourcesByAddressPrefix(state, `github_${resource}.this`);
    const gitHubResources = output[resource];

    for (const gitHubResource of gitHubResources) {
      const existsInState = stateResources.find(stateResource => {
        return stateResource.index == gitHubResource.index;
      });
      if (! existsInState) {
        await cli.exec(`terraform import -lock=${lock} "github_${resource}.this[${gitHubResource.index}]" "${gitHubResource.id}"`, null, { cwd: `${__rootdirname}/terraform` });
      }
    }

    for (const stateResource of stateResources) {
      const existsInGitHub = gitHubResources.find(gitHubResource => {
        return gitHubResource.index == stateResource.index;
      });
      if (! existsInGitHub) {
        await cli.exec(`terraform state rm -lock=${lock} "github_${resource}.this[${stateResource.index}]"`, null, { cwd: `${__rootdirname}/terraform` });
      }
    }
  }

  state = await terraform.getStateJSON();

  for (const resource of resources) {
    const keys = resourceToKeys[resource];
    const ignoreChanges = resourcesOverrideTF[resource]?.this?.lifecycle?.ignore_changes || resourcesTF[resource]?.this?.lifecycle?.ignore_changes

    let stateResources = getResourcesByAddressPrefix(state, `github_${resource}.this`);

    switch(resource) {
      case "team":
        stateResources = stateResources.map(stateResource => {
          stateResource.values.parent_team_id = stateResources.find(otherStateResource => {
            return otherStateResource.values.id == stateResource.values.parent_team_id;
          })?.values.name || stateResource.values.parent_team_id;
          return stateResource;
        });
        break;
      case "repository_file":
        const contentToRelpath = {};
        const paths = (await (await glob.create(`${__rootdirname}/files/**`, { matchDirectories: false })).glob())
        for (const path of paths) {
          const content = fs.readFileSync(path);
          const relpath = `./${path.substring(`${__rootdirname}/files/`.length)}`;
          contentToRelpath[content.toString('base64')] = relpath;
        }
        stateResources = stateResources.map(stateResource => {
          stateResource.values.content = contentToRelpath[stateResource.values.content] || stateResource.values.content;
          return stateResource;
        });
        break;
    }

    stateResources = stateResources.map(stateResource => {
      for (const key of keys) {
        delete stateResource.values[key];
      }
      for (const ignore of ignoreChanges) {
        delete stateResource.values[ignore];
      }
      return stateResource;
    });

    arr.reduce(function(map, obj) {
      map[obj.key] = obj.val;
      return map;
    }, {});

    stateResources = stateResources.map(stateResource => {
      const indexParts = stateResource.index.split(localsTF.separator);
      stateResource = stateResource.values;
      for (const indexPart of indexParts.reverse()) {
        stateResource = { [indexPart]: stateResource };
      }
      return stateResource;
    });

    fs.writeFileSync(`${__rootdirname}/github/${organization}/${resource}.json`, JSON.stringify(stateResources, null, 2));
  }
}

main();
