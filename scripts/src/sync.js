import merge from 'deepmerge';
import { Resources as ResourceHelpersByType, Paths } from './resources.js';
import { Config as YamlConfig } from './config.js';
import { Terraform } from './terraform.js';

export const Sync = {
  sync: async (yaml) => {
    // Loading organization config
    const yamlConfig = new YamlConfig(yaml);

    await Terraform.refresh();
    let resourcesTerraformKnowsAboutByType = await Terraform.getResourcesFromState();
    const resourcesGitHubKnowsAboutByType = await Terraform.getResourcesFromOutput();

    await Paths.init();
    const allResourceTypes = Object.keys(ResourceHelpersByType);
    const mergeOptions = { arrayMerge: (_a, b) => { return b; } };
    const managedResourceTypes = merge(...Terraform.getFile('locals').locals, mergeOptions).resource_types;
    const ignoredPropertiesByResourceType = Object.fromEntries(
      Object.entries(Terraform.getFile('resources').resource).filter(([key, _value]) => {
        return key.startsWith('github');
      }).map(([key, value]) => {
          return [key, merge(...value.this.flatMap(v => { return v.lifecycle; }), mergeOptions).ignore_changes.map(property => {
            return property.slice(2, -1);
          })];
        }
      )
    );

    for (const resourceType of allResourceTypes) {
      // Sync TF State with GitHub

      const resourcesTerraformKnowsAbout = resourcesTerraformKnowsAboutByType[resourceType] || [];
      const resourcesGitHubKnowsAbout = resourcesGitHubKnowsAboutByType[resourceType] || [];

      for (const terraformResource of resourcesTerraformKnowsAbout) {
        if (! managedResourceTypes.includes(terraformResource.type)) {
          await Terraform.delete(terraformResource);
        } else {
          const notInGitHubAnymore = ! resourcesGitHubKnowsAbout.find(gitHubResource => {
            return terraformResource.index == gitHubResource.index;
          });
          if (notInGitHubAnymore) {
            await Terraform.delete(terraformResource)
          }
        }
      }

      if (managedResourceTypes.includes(resourceType)) {
        for (const gitHubResource of resourcesGitHubKnowsAbout) {
          const notInTerraformStateYet = ! resourcesTerraformKnowsAbout.find(terraformResource => {
            return terraformResource.index == gitHubResource.index;
          });
          if (notInTerraformStateYet) {
            await Terraform.import(gitHubResource);
          }
        }
      }
    }

    // Retrieving resources again because we manipulated the state in the loop above
    // We do not care about resources from GitHub anymore because terraform state is synced already
    resourcesTerraformKnowsAboutByType = await Terraform.getResourcesFromState();

    // Sync YAML config with TF state
    for (const resourceType of allResourceTypes) {
      const ResourceHelper = ResourceHelpersByType[resourceType];

      // Retrieve resources that YAML config knows about
      const resourcesYamlConfigKnowsAbout = yamlConfig.find(ResourceHelper.getPathToAllTheResources());

      if (! managedResourceTypes.includes(resourceType)) {
        for (const yamlConfigResource of resourcesYamlConfigKnowsAbout) {
          yamlConfig.delete(yamlConfigResource);
        }
      } else {
        const resourcesTerraformKnowsAbout = resourcesTerraformKnowsAboutByType[resourceType] || [];
        const ignoredProperties = ignoredPropertiesByResourceType[resourceType];

        for (const yamlConfigResource of resourcesYamlConfigKnowsAbout) {
          const terraformResource = resourcesTerraformKnowsAbout.find(terraformResource => {
            return terraformResource.index == ResourceHelper.getIndex(yamlConfigResource);
          });
          // Remove all the resources that exist in YAML config but do not exist in TF state anymore
          if (! terraformResource) {
            yamlConfig.delete(yamlConfigResource)
          } else {
            const yamlConfigPath = ResourceHelper.getPathToTheResource(terraformResource, resourcesTerraformKnowsAboutByType.data);
            // Move all the resources within the YAML config for which the path has changed
            if (! yamlConfig.has(yamlConfigPath)) {
              yamlConfig.move(yamlConfigResource, yamlConfigPath);
            }
          }
        }

        for (const terraformResource of resourcesTerraformKnowsAbout) {
          const yamlConfigPath = ResourceHelper.getPathToTheResource(terraformResource, resourcesTerraformKnowsAboutByType.data);

          // Add all the resources that exist in TF state but do not exist in YAML config yet
          // Update all the resources that already exist in YAML config
          if (! yamlConfig.has(yamlConfigPath)) {
            yamlConfig.add(yamlConfigPath);
          } else {
            yamlConfig.update(yamlConfigPath);
          }
          // Ignore keys as per resources_override
          yamlConfig.ignore(yamlConfigPath, merge(ResourceHelper.getIgnoredProperties(ignoredProperties), ignoredProperties));
        }
      }
    }

    return yamlConfig.toString();
  }
}
