import HCL from 'hcl2-parser';
import cli from '@actions/exec';
import merge from 'deepmerge';
import fs from 'fs';

export const Terraform = {
  // This controls wether we take out a lock while accessing remote terraform resources
  // Using a lock is slower but more secure - defaults to using the locking mechanism
  LOCK: process.env.TF_LOCK != 'false',
  CWD: `${process.cwd()}/../terraform`,

  getWorkspace: async () => {
    let workspace = '';
    await cli.exec('terraform workspace show', null, {
      cwd: Terraform.CWD,
      listeners: { stdout: data => { workspace += data.toString(); } }
    })
    return workspace.trim();
  },
  getResourcesFromState: async () => {
    let content = '';
    await cli.exec('terraform show -json', null, {
      cwd: Terraform.CWD,
      listeners: { stdout: data => { content += data.toString(); } },
      silent: true
    });
    const state = JSON.parse(content);
    return state.values.root_module.resources.map(resource => {
      resource.id = resource.values.id;
      resource.type = resource.address.split('.')[0];
      return resource;
    }).reduce((resources, resource) => {
      resources[resource.type] = resources[resource.type] || [];
      resources[resource.type].push(resource);
      return resources;
    }, {});
  },
  getResourcesFromOutput: async () => {
    let content = '';
    await cli.exec('terraform output -json', null, {
      cwd: Terraform.CWD,
      listeners: { stdout: data => { content += data.toString(); } },
      silent: true
    });
    return Object.entries(JSON.parse(content)).flatMap(([type, resources]) => {
      return resources.value.map(resource => {
        return {
          type: type,
          id: (resource.id || resource).toString(),
          index: (resource.index || resource).toString()
        }
      });
    }).map(resource => {
      resource.address = `${resource.type}.this["${resource.index}"]`;
      return resource;
    }).reduce((resources, resource) => {
      resources[resource.type] = resources[resource.type] || [];
      resources[resource.type].push(resource);
      return resources;
    }, {});;
  },
  getFile: (name) => {
    const content = fs.readFileSync(`${Terraform.CWD}/${name}.tf`);
    const parsedContent = HCL.parseToObject(content)[0];
    if (fs.existsSync(`${Terraform.CWD}/${name}_override.tf`)) {
      const overrideContent = fs.readFileSync(`${Terraform.CWD}/${name}_override.tf`);
      const parsedOverrideContent = HCL.parseToObject(overrideContent)[0];
      return merge(parsedContent, parsedOverrideContent);
    } else {
      return parsedContent;
    }
  },
  refresh: async () => {
    await cli.exec(`terraform refresh -target=null_resource.resources -lock=${Terraform.LOCK}`, null, { cwd: Terraform.CWD });
    await cli.exec(`terraform apply -target=null_resource.data -auto-approve -lock=${Terraform.LOCK}`, null, { cwd: Terraform.CWD });
  },
  import: async (resource) => {
    await cli.exec(`terraform import -lock=${Terraform.LOCK} "${resource.address.replaceAll('"', '\\"')}" "${resource.id.replaceAll('"', '\\"')}"`, null, { cwd: Terraform.CWD });
  },
  delete: async (resource) => {
    await cli.exec(`terraform state rm -lock=${Terraform.LOCK} "${resource.address.replaceAll('"', '\\"')}"`, null, { cwd: Terraform.CWD });
  }
}
