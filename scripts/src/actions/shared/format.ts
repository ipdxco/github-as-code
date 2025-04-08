import {Config} from '../../yaml/config.js'

export async function runFormat(): Promise<void> {
  const config = Config.FromPath()
  config.save()
}

export async function format(_config: Config): Promise<void> {}
