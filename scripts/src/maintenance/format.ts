import 'reflect-metadata'
import {Config} from '../yaml/config'

async function run(): Promise<void> {
  const config = Config.FromPath()
  config.save()
}

run()
