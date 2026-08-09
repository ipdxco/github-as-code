import assert from 'node:assert'
import {existsSync, readFileSync} from 'node:fs'
import {describe, it} from 'node:test'
import * as YAML from 'yaml'

type WorkflowStep = {
  name?: string
  run?: string
  env?: Record<string, string>
  with?: Record<string, unknown>
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

  it('does not provide a manual access report workflow', () => {
    assert.equal(existsSync('../.github/workflows/access-report.yml'), false)
  })

  it('publishes the full access report from the fix workflow', () => {
    const fix = workflow('fix.yml')
    const steps = fix.jobs.fix.steps.map(step => step.name)

    assert.ok(steps.includes('Publish access report summary'))
    assert.ok(steps.includes('Upload access report'))
  })

  it('downloads only fixed YAML config artifacts before pushing fix changes', () => {
    const fix = workflow('fix.yml')
    const fixSteps = fix.jobs.fix.steps
    const pushSteps = fix.jobs.push.steps
    const uploadYamlStep = fixSteps.find(
      step => step.name === 'Upload YAML config'
    )
    const downloadYamlStep = pushSteps.find(
      step => step.name === 'Download YAML configs'
    )
    const copyYamlStep = pushSteps.find(
      step => step.name === 'Copy YAML configs'
    )

    assert.ok(uploadYamlStep)
    assert.ok(downloadYamlStep)
    assert.ok(copyYamlStep)
    assert.equal(
      uploadYamlStep.with?.name,
      'fixed-config-${{ env.TF_WORKSPACE }}'
    )
    assert.equal(downloadYamlStep.with?.pattern, 'fixed-config-*')
    assert.equal(downloadYamlStep.with?.['merge-multiple'], true)
    assert.equal(copyYamlStep.run, 'cp artifacts/*.yml head/github')
  })
})
