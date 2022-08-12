import 'reflect-metadata'

import {Config as YAMLConfig} from '../src/yaml/config'
import {State as TFConfig} from '../src/terraform/state'
import {sync} from '../src/sync'

test('sync', async () => {
  const yamlConfig = new YAMLConfig('{}')
  const tfConfig = await TFConfig.New()

  const expectedYamlConfig = YAMLConfig.FromPath()

  await sync(tfConfig, yamlConfig)

  yamlConfig.format()

  expect(yamlConfig.toString()).toEqual(expectedYamlConfig.toString())
})
