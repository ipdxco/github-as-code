import fs from 'fs';
import HCL from 'hcl2-parser';
import cli from '@actions/exec';
import glob from '@actions/glob';
import YAML from 'yaml';
import merge from 'deepmerge';
import { config } from 'process';


const __dirname = process.cwd();
const __rootdirname = fs.realpathSync(`${__dirname}/..`);

function getStateResources(state, resourceType) {
  let modules = [state?.values?.root_module]
  modules = modules.concat(state?.values?.root_module?.child_modules || []);
  const resources = modules.flatMap(module => { return module.resources; });
  return resources.filter(resource => { return resource.address.startsWith(`${resourceType}.this`); });
}

const Terraform = {
  // This controls wether we take out a lock while accessing remote terraform resources
  // Using a lock is slower but more secure - defaults to using the locking mechanism
  LOCK: process.env.TF_LOCK != 'false',

  getWorkspace: async () => {
    let workspace = '';
    await cli.exec('terraform workspace show', null, {
      cwd: `${__rootdirname}/terraform`,
      listeners: { stdout: data => { workspace += data.toString(); } }
    })
    return workspace.trim();
  },
  getResourcesFromStateByType: async () => {
    let content = '';
    await cli.exec('terraform show -json', null, {
      cwd: `${__rootdirname}/terraform`,
      listeners: { stdout: data => { content += data.toString(); } },
      silent: true
    });
    const state = JSON.parse(content);
    return Object.fromEntries(state.values.root_module.resources.map(resource => {
      [resource.address.split('.')[0], resource]
    }));
  },
  getResourcesFromOutputByType: async () => {
    let content = '';
    await cli.exec('terraform output -json', null, {
      cwd: `${__rootdirname}/terraform`,
      listeners: { stdout: data => { content += data.toString(); } },
      silent: true
    });
    return JSON.parse(content);
  },
  getFile: (name) => {
    const content = fs.readFileSync(`${__rootdirname}/terraform/${name}.tf`);
    const parsedContent = HCL.parseToObject(content)[0];
    if (fs.existsSync(`${__rootdirname}/terraform/${name}_override.tf`)) {
      const overrideContent = fs.readFileSync(`${__rootdirname}/terraform/${name}_override.tf`);
      const parsedOverrideContent = HCL.parseToObject(overrideContent)[0];
      return merge(parsedContent, parsedOverrideContent, { arrayMerge: overwriteMerge });
    } else {
      return parsedContent;
    }
  },
  refresh: async () => {
    await cli.exec(`terraform refresh -target=null_resource.resources -lock=${this.LOCK}`, null, { cwd: `${__rootdirname}/terraform` });
    await cli.exec(`terraform apply -target=null_resource.data -auto-approve -lock=${this.LOCK}`, null, { cwd: `${__rootdirname}/terraform` });
  },
  import: async (resourceType, resourceId) => {
    await cli.exec(`terraform import -lock=${this.LOCK} "github_${resourceType}.this[${resourceId}]" "${resourceId}"`, null, { cwd: `${__rootdirname}/terraform` });
  },
  delete: async (resourceType, resourceId) => {
    await cli.exec(`terraform state rm -lock=${this.LOCK} "github_${resourceType}.this[${resourceId}]"`, null, { cwd: `${__rootdirname}/terraform` });
  }
}

class YamlConfig {
  constructor(organization) {
    this.config = YAML.parseDocument(fs.readFileSync(`${__rootdirname}/github/${organization}.yml`, 'utf8'));
    this.updatePaths()
  }

  updatePaths() {
    const items = [this.config];
    while (items.length != 0) {
      const item = items.pop();
      if (item.contents?.items || item.value?.items) {
        (item.contents?.items || item.value?.items).forEach(child => {
          child.path = [...(item.path || []), child.key?.value || child.value]
          items.push(child);
        });
      }
    }
  }

  find(path) {
    return path.reduce((items, pathElement) => {
      return items
        .flatMap(item => {
          return item.value?.items || item;
        })
        .filter(item => {
          return (item.key?.value || item.value).match(new RegExp(`^${pathElement.key || pathElement}$`));
        });
    }, [{value: this.config.contents}]);
  }

  add(path) {
    for (const [index, pathElement] of Object.entries(path)) {
      if (! this.has(path.slice(0, index + 1))) {
        const parent = this.find(path.slice(0, index))[0];
        if (index + 1 == path.length) {
          if (YAML.isNode(pathElement) || YAML.isPair(pathElement)) {
            parent.value.items.push(pathElement);
          } else {
            parent.value.items.push(YAML.parseDocument(YAML.stringify(pathElement)).contents);
          }
        } else {
          parent.value.items.push(new YAML.Pair(new YAML.Scalar(pathElement), new YAML.YAMLMap()));
        }
      }
    }
  }

  delete(resource) {
    const parent = this.find(resource.path.slice(0, -1))[0];
    parent.value.items = parent.value.items.filter(child => {
      return child !== resource;
    });
  }

  move(resource, path) {
    this.add([...path.slice(0, -1), resource]);
    this.delete(resource);
  }

  toString() {
    return this.config.toString({ collectionStyle: 'block' });
  }

  has(path) {
    return this.find(path).length != 0;
  }

  update(path, keys) {
    const resource = this.find(path)[0];
    if (YAML.isMap(resource)) {
      resource.value.items = resource.value.items.filter(item => {
        return ! keys.includes(item.key.value);
      });
    }
  }
}

const ResourceHelpersByType = {
  github_membership: {
    getYamlConfigPathToAllTheResources: () => { return ['members', '(admin|member)', '.+']; },
    getYamlConfigPathToTheResource: (resourceFromTerraformState) => {
      return ['members', resourceFromTerraformState.values.role, resourceFromTerraformState.values.username];
    },
    getId: (resourceFromYamlConfig) => {
      return resourceFromYamlConfig.value;
    }
  },
  github_repository: {
    getYamlConfigPathToAllTheResources: () => { return ['repositories', '.+']; },
    getYamlConfigPathToTheResource: (resourceFromTerraformState) => {
      return ['repositories', { key: resourceFromTerraformState.values.name, value: resourceFromTerraformState.values }];
    },
    getId: (resourceFromYamlConfig) => {
      return resourceFromYamlConfig.key.value;
    }
  },
  github_repository_collaborator: {
    getYamlConfigPathToAllTheResources: () => { return ['repositories', '.+', 'collaborators', '(admin|maintain|push|triage|pull)', '.+']; },
    getYamlConfigPathToTheResource: (resourceFromTerraformState) => {
      return ['repositories', resourceFromTerraformState.values.repository, 'collaborators', resourceFromTerraformState.values.permission, resourceFromTerraformState.values.username];
    },
    getId: (resourceFromYamlConfig) => {
      return `${resourceFromYamlConfig.path[1].key.value}:${resourceFromYamlConfig.value}`;
    }
  },
  github_branch_protection: {
    getYamlConfigPathToAllTheResources: () => { return ['repositories', '.+', 'branch_protection', '.+']; },
    getYamlConfigPathToTheResource: (resourceFromTerraformState) => {
      return ['repositories', resourceFromTerraformState.values.repository_id, 'branch_protection', { key: resourceFromTerraformState.values.pattern, value: resourceFromTerraformState.values }];
    },
    getId: (resourceFromYamlConfig) => {
      return `${resourceFromYamlConfig.path[1].key.value}:${resourceFromYamlConfig.key.value}`;
    }
  },
  github_team: {
    getYamlConfigPathToAllTheResources: () => { return ['teams', '.+']; },
    getYamlConfigPathToTheResource: (resourceFromTerraformState) => {
      return ['teams', { key: resourceFromTerraformState.values.name, value: resourceFromTerraformState.values }];
    },
    getId: (resourceFromYamlConfig) => {
      return resourceFromYamlConfig.key.value;
    }
  },
  github_team_repository: {
    getYamlConfigPathToAllTheResources: () => { return ['repositories', '.+', 'teams', '(admin|maintain|push|triage|pull)', '.+']; },
    getYamlConfigPathToTheResource: (resourceFromTerraformState) => {
      return ['repositories', resourceFromTerraformState.values.repository, 'teams', resourceFromTerraformState.values.permission, resourceFromTerraformState.values.team];
    },
    getId: (resourceFromYamlConfig) => {
      return `${resourceFromYamlConfig.value}:${resourceFromYamlConfig.path[1].key.value}`;
    }
  },
  github_team_membership: {
    getYamlConfigPathToAllTheResources: () => { return ['teams', '.+', 'members', '(maintainer|member)', '.+']; },
    getYamlConfigPathToTheResource: (resourceFromTerraformState) => {
      return ['teams', resourceFromTerraformState.values.team_id, 'members', resourceFromTerraformState.values.role, resourceFromTerraformState.values.username];
    },
    getId: (resourceFromYamlConfig) => {
      return `${resourceFromYamlConfig.path[1].key.value}:${resourceFromYamlConfig.value}`;
    }
  },
  github_repository_file: {
    getYamlConfigPathToAllTheResources: () => { return ['repositories', '.+', 'files', '.+']; },
    getYamlConfigPathToTheResource: (resourceFromTerraformState) => {
      return ['repositories', resourceFromTerraformState.values.repository, 'files', { key: resourceFromTerraformState.values.file, value: resourceFromTerraformState.values }];
    },
    getId: (resourceFromYamlConfig) => {
      return `${resourceFromYamlConfig.path[1].key.value}/${resourceFromYamlConfig.key.value}:${resourceFromYamlConfig.value.items.find(item => { return item.key.value == 'branch'; }).value.value}`;
    }
  }
}

async function main() {
  const organization = Terraform.getWorkspace();
  // Loading organization config
  const yamlConfig = new YamlConfig(organization);

  await Terraform.refresh();
  let resourcesTerraformKnowsAboutByType = await Terraform.getResourcesFromStateByType();
  let resourcesGitHubKnowsAboutByTYpe = await Terraform.getResourcesFromOutputByType();

  const allResourceTypes = Object.keys(ResourceHelpersByType);
  const managedResourceTypes = Terraform.getFile('locals').locals.resource_types;
  const ignoredPropertiesByResourceType = Object.fromEntries(
    Object.entries(
      Terraform.getFile('resources').resource).map(([key, value]) => {
        return [key, value.this.lifecycle.ignore_changes];
      }
    )
  );

  // Sync Terraform State with GitHub
  for (const resourceType of allResourceTypes) {
    const resourcesTerraformKnowsAbout = resourcesTerraformKnowsAboutByType[resourceType];
    const resourcesGitHubKnowsAbout = resourcesGitHubKnowsAbout[resourceType];

    if (managedResourceTypes.includes(resourceType)) {
      // Import all the resources that exist in GitHub but do not exist in TF state yet
      for (const gitHubResource of resourcesGitHubKnowsAbout) {
        const notInTerraformStateYet = ! resourcesTerraformKnowsAbout.find(terraformResource => {
          return terraformResource.id == gitHubResource;
        });
        if (notInTerraformStateYet) {
          await Terraform.import(resourceType, gitHubResource);
        }
      }

      // Remove all the resources that exist in TF state but do not exist in GitHub anymore
      for (const terraformResource of resourcesTerraformKnowsAbout) {
        const notInGitHubAnymore = ! resourcesGitHubKnowsAbout.find(gitHubResource => {
          return gitHubResource == terraformResource.id;
        });
        if (notInGitHubAnymore) {
          await Terraform.delete(resourceType, terraformResource.id)
        }
      }
    } else {
      // Remove all the resources from state for resource types not managed through GitHub Management
      for (const terraformResource of resourcesTerraformKnowsAbout) {
        await Terraform.delete(resourceType, terraformResource.id)
      }
    }
  }

  // Retrieving resources again because we manipulated the state in the loop above
  // We do not care about resources from GitHub anymore because terraform state is synced already
  resourcesTerraformKnowsAboutByType = await Terraform.getResourcesFromStateByType();

  // Sync YAML config with TF state
  for (const resourceType of managedResourceTypes) {
    const resourceHelper = ResourceHelpersByType[resourceType];

    // Retrieve resources that TF knows about
    const resourcesTerraformKnowsAbout = resourcesTerraformKnowsAboutByType[resourceType];
    // Retrieve resources that YAML config knows about
    const resourcesYamlConfigKnowsAbout = yamlConfig.find(resourceHelper.getYamlConfigPathToAllTheResources());

    const ignoredProperties = ignoredPropertiesByResourceType[resourceType];

    // Remove all the resources that exist in YAML config but do not exist in TF state anymore
    // Move all the resources within the YAML config for which the path has changed
    for (const yamlConfigResource of resourcesYamlConfigKnowsAbout) {
      const terraformResource = resourcesTerraformKnowsAbout.find(terraformResource => {
        return terraformResource.id == resourceHelper.getId(yamlConfigResource);
      });
      if (! terraformResource) {
        yamlConfig.delete(yamlConfigResource)
      } else {
        const yamlConfigPath = resourceHelper.getYamlConfigPathToTheResource(terraformResource);
        if (! yamlConfig.has(yamlConfigPath)) {
          yamlConfig.move(yamlConfigResource, yamlConfigPath);
        }
      }
    }

    // Add all the resources that exist in TF state but do not exist in YAML config yet
    // Update properties of all the resources
    for (const terraformResource of resourcesTerraformKnowsAbout) {
      const yamlConfigPath = resourceHelper.getYamlConfigPathToTheResource(terraformResource);

      if (yamlConfig.has(yamlConfigPath)) {
        yamlConfig.update(yamlConfigPath);
      } else {
        yamlConfig.add(yamlConfigPath);
      }
      yamlConfig.ignore(yamlConfigPath, ignoredProperties);
    }
  }


   // fs.writeFileSync(`${__rootdirname}/github/${organization}/${resource}.json`, JSON.stringify(resourceFromTerraformStates, null, 2));
}

main();
