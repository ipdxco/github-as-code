import 'reflect-metadata'

import * as fs from 'fs'
import * as core from '@actions/core'
import {Config} from '../yaml/config.js'
import {State} from '../terraform/state.js'
import {describeAccessReport} from './shared/describe-access-changes.js'

async function run(): Promise<void> {
  const state = await State.New()
  const config = Config.FromPath()
  const accessReport = describeAccessReport(state, config)
  const accessReportPath = process.env.ACCESS_REPORT_PATH ?? 'ACCESS_REPORT.md'

  fs.writeFileSync(accessReportPath, accessReport)
}

run().catch(error => core.setFailed(error))
