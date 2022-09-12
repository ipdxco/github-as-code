import {Config} from '../../yaml/config'

export async function format(): Promise<void> {
  const config = Config.FromPath()
  config.save()
}
