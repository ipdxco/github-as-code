import fs from 'fs';
import { Sync } from './sync.js';
import { Terraform } from './terraform.js';

async function main() {
  const organization = await Terraform.getWorkspace();
  const oldYaml = fs.readFileSync(`${process.cwd()}/../github/${organization}.yml`, 'utf8');
  const newYaml = await Sync.sync(yaml);
  fs.writeFileSync(`${process.cwd()}/../github/${organization}.yml`, newYaml);
}

main();
