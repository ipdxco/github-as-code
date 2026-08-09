import assert from 'node:assert'
import {readFileSync} from 'node:fs'
import {describe, it} from 'node:test'
import * as YAML from 'yaml'

type WorkflowStep = {
  name?: string
  run?: string
  env?: Record<string, string>
}

type Workflow = {
  on: {
    workflow_dispatch?: unknown
  }
  jobs: Record<
    string,
    {
      environment?: string
      steps: WorkflowStep[]
    }
  >
}

function workflow(path: string): Workflow {
  return YAML.parse(readFileSync(`../.github/workflows/${path}`, 'utf8'))
}

describe('workflows', () => {
  it('guards allow-destroy override steps with an environment variable', () => {
    const plan = workflow('plan.yml')
    const apply = workflow('apply.yml')
    const planStep = plan.jobs.plan.steps.find(
      step => step.name === 'Allow destroy in guarded environment'
    )
    const applyStep = apply.jobs.apply.steps.find(
      step => step.name === 'Allow destroy in guarded environment'
    )

    assert.ok(planStep)
    assert.ok(applyStep)
    assert.equal(planStep.env?.ALLOW_DESTROY, '${{ vars.ALLOW_DESTROY }}')
    assert.match(planStep.run ?? '', /ALLOW_DESTROY.*true/)
    assert.match(planStep.run ?? '', /allow_destroy_override\.tf\.disabled/)
    assert.equal(applyStep.env?.ALLOW_DESTROY, '${{ vars.ALLOW_DESTROY }}')
    assert.match(applyStep.run ?? '', /ALLOW_DESTROY.*true/)
    assert.match(applyStep.run ?? '', /allow_destroy_override\.tf\.disabled/)
  })

  it('provides a manual access report workflow with summary and artifact output', () => {
    const report = workflow('access-report.yml')
    const steps = report.jobs.report.steps.map(step => step.name)

    assert.ok(report.on.workflow_dispatch)
    assert.equal(report.jobs.report.environment, 'read')
    assert.ok(steps.includes('Generate access report'))
    assert.ok(steps.includes('Publish access report summary'))
    assert.ok(steps.includes('Upload access report'))
  })
})
