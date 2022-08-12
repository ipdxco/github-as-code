import 'reflect-metadata'
import {sync} from './sync'
import {State} from './terraform/state'
import {Config} from './yaml/config'

async function run(): Promise<void> {
  const state = await State.New()
  const config = Config.FromPath()

  sync(state, config)

  config.save()
}

run()
