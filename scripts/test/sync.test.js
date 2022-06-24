
import { jest } from '@jest/globals';
import fs from 'fs';

jest.unstable_mockModule('fs', () => {
  return {
    default: {
      realpathSync: () => {
        return fs.realpathSync(`${process.cwd()}/test/resources`);
      },
      readFileSync: (path) => {
        if (path.endsWith('terraform/locals_override.tf')) {
          return fs.readFileSync('test/resources/locals_override.tf');
        } else if (path.endsWith('terraform/resources_override.tf')) {
          return fs.readFileSync('test/resources/resources_override.tf');
        } else if (path.endsWith('terraform/locals.tf')) {
          return fs.readFileSync(path);
        } else if (path.endsWith('terraform/resources.tf')) {
          return fs.readFileSync(path);
        } else if (path.endsWith('files/README.md')) {
          return fs.readFileSync(path);
        } else {
          throw new Error(path);
        }
      },
      existsSync: (path) => {
        if (path.endsWith('terraform/locals_override.tf')) {
          return true;
        } else if (path.endsWith('terraform/resources_override.tf')) {
          return true;
        } else {
          throw new Error(path);
        }
      }
    }
  };
});

jest.unstable_mockModule('@actions/exec', () => {
  return {
    default: {
      exec: async (command, _args, options) => {
        if (command.startsWith('terraform refresh')) {
          return;
        } else if (command.startsWith('terraform apply')) {
          return;
        } else if (command == 'terraform show -json') {
          const json = fs.readFileSync('test/resources/state.json');
          options.listeners.stdout(json);
          return;
        } else if (command == 'terraform output -json') {
          const json = fs.readFileSync('test/resources/output.json');
          options.listeners.stdout(json);
          return;
        } else {
          throw new Error(command);
        }
      }
    }
  };
});

const { Sync } = await import('../src/sync.js');

test('should generate config given terraform state', () => {
  const expectedYaml = fs.readFileSync('test/resources/config.yaml', 'utf-8');
  return Sync.sync('{}').then((actualYaml) => {
    expect(actualYaml).toEqual(expectedYaml);
  });
});
