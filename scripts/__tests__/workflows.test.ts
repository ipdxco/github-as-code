import assert from 'node:assert'
import {existsSync, readFileSync} from 'node:fs'
import {describe, it} from 'node:test'
import * as YAML from 'yaml'

type WorkflowStep = {
  name?: string
  if?: string
  uses?: string
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
      permissions?: Record<string, string>
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

  it('provides a manual access report workflow through the shared formatter helper', () => {
    assert.equal(existsSync('../.github/workflows/access-report.yml'), true)

    const accessReport = workflow('access-report.yml')
    const reportJob = accessReport.jobs.report
    const steps = reportJob.steps
    const generateStep = steps.find(
      step => step.name === 'Generate access report'
    )
    const publishStep = steps.find(
      step => step.name === 'Publish access report summary'
    )
    const uploadStep = steps.find(step => step.name === 'Upload access report')

    assert.ok(accessReport.on.workflow_dispatch)
    assert.equal(reportJob.environment, 'read')
    assert.ok(generateStep)
    assert.equal(generateStep.env?.ACCESS_REPORT_PATH, '../ACCESS_REPORT.md')
    assert.match(generateStep.run ?? '', /runDescribeAccessChanges/)
    assert.doesNotMatch(generateStep.run ?? '', /access-report\.js/)
    assert.ok(publishStep)
    assert.equal(
      publishStep.run,
      'cat ACCESS_REPORT.md >> "$GITHUB_STEP_SUMMARY"'
    )
    assert.ok(uploadStep)
    assert.equal(uploadStep.with?.name, 'access-report-${{ env.TF_WORKSPACE }}')
    assert.equal(uploadStep.with?.path, 'ACCESS_REPORT.md')
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

  it('publishes planned terraform targets and rendered plan summaries', () => {
    const plan = workflow('plan.yml')
    const planSteps = plan.jobs.plan.steps
    const commentSteps = plan.jobs.comment.steps
    const targetStep = planSteps.find(
      step => step.name === 'Summarize plan target'
    )
    const publishStep = commentSteps.find(
      step => step.name === 'Publish terraform plans summary'
    )
    const uploadStep = commentSteps.find(
      step => step.name === 'Upload terraform plans summary'
    )

    assert.ok(targetStep)
    assert.equal(
      targetStep.env?.ENVIRONMENT_REASONS,
      '${{ toJson(matrix.environmentReasons) }}'
    )
    assert.match(targetStep.run ?? '', /## Plan target/)
    assert.match(targetStep.run ?? '', /Pull request/)
    assert.match(targetStep.run ?? '', /Source SHA/)
    assert.match(targetStep.run ?? '', /Environment reason/)
    assert.match(targetStep.run ?? '', /Terraform plan artifact/)
    assert.ok(publishStep)
    assert.equal(
      publishStep.run,
      'cat TERRAFORM_PLANS.md >> "$GITHUB_STEP_SUMMARY"'
    )
    assert.ok(uploadStep)
    assert.equal(
      uploadStep.with?.name,
      'terraform-plans-${{ github.event.pull_request.head.sha || github.sha }}'
    )
    assert.equal(uploadStep.with?.path, 'terraform/TERRAFORM_PLANS.md')
  })

  it('publishes apply targets and reviewed plan summaries', () => {
    const apply = workflow('apply.yml')
    const steps = apply.jobs.apply.steps
    const targetStep = steps.find(
      step => step.name === 'Summarize apply target'
    )
    const reviewedStep = steps.find(
      step => step.name === 'Show reviewed terraform plan'
    )
    const mergedStep = steps.find(
      step => step.name === 'Show merged terraform plan'
    )
    const uploadStep = steps.find(
      step => step.name === 'Upload apply plan summaries'
    )
    const compareStep = steps.find(
      step => step.name === 'Compare reviewed and merged plans'
    )

    assert.ok(targetStep)
    assert.equal(
      targetStep.env?.ENVIRONMENT_REASONS,
      '${{ toJson(matrix.environmentReasons) }}'
    )
    assert.match(targetStep.run ?? '', /## Apply target/)
    assert.match(targetStep.run ?? '', /Reviewed SHA/)
    assert.match(targetStep.run ?? '', /Environment reason/)
    assert.match(targetStep.run ?? '', /Reviewed plan artifact/)
    assert.ok(reviewedStep)
    assert.match(reviewedStep.run ?? '', /## Reviewed Terraform plan/)
    assert.match(reviewedStep.run ?? '', /\.reviewed\.txt/)
    assert.ok(mergedStep)
    assert.match(mergedStep.run ?? '', /## Merged Terraform plan/)
    assert.match(mergedStep.run ?? '', /\.merged\.txt/)
    assert.ok(uploadStep)
    assert.equal(
      uploadStep.with?.name,
      'apply-plans-${{ env.TF_WORKSPACE }}-${{ needs.prepare.outputs.sha }}'
    )
    assert.match(String(uploadStep.with?.path), /\.reviewed\.txt/)
    assert.match(String(uploadStep.with?.path), /\.merged\.txt/)
    assert.ok(compareStep)
    assert.equal(
      compareStep.run,
      'diff -u "${TF_WORKSPACE}.reviewed.txt" "${TF_WORKSPACE}.merged.txt"\n'
    )
  })

  it('creates update-members pull requests with the GitHub App token', () => {
    const updateMembers = workflow('update-members.yml')
    const job = updateMembers.jobs.update
    const steps = job.steps
    const generateTokenStep = steps.find(
      step => step.name === 'Generate app token'
    )
    const checkoutStep = steps.find(
      step => step.name === 'Checkout with app token'
    )
    const configureGitStep = steps.find(
      step => step.name === 'Configure git user'
    )
    const createPullRequestStep = steps.find(
      step => step.name === 'Create draft pull request'
    )

    assert.equal(job.permissions?.contents, 'read')
    assert.equal(job.permissions?.['pull-requests'], 'read')
    assert.ok(generateTokenStep)
    assert.equal(
      generateTokenStep.if,
      "github.event.inputs['draft-run'] != 'true'"
    )
    assert.equal(
      generateTokenStep.with?.app_id,
      '${{ secrets.RW_GITHUB_APP_ID }}'
    )
    assert.ok(checkoutStep)
    assert.equal(checkoutStep.if, "github.event.inputs['draft-run'] != 'true'")
    assert.equal(checkoutStep.with?.token, '${{ steps.token.outputs.token }}')
    assert.ok(configureGitStep)
    assert.equal(
      configureGitStep.if,
      "steps.config-modified.outputs.this == 'true' && github.event.inputs['draft-run'] != 'true'"
    )
    assert.equal(
      configureGitStep.env?.GITHUB_MGMT_APP_ID,
      '${{ secrets.RW_GITHUB_APP_ID }}'
    )
    assert.match(configureGitStep.run ?? '', /github-mgmt\[bot\]/)
    assert.ok(createPullRequestStep)
    assert.equal(
      createPullRequestStep.env?.GITHUB_TOKEN,
      '${{ steps.token.outputs.token }}'
    )
  })

  it('supports update-members draft runs without creating pull requests', () => {
    const updateMembers = workflow('update-members.yml')
    const workflowDispatch = updateMembers.on.workflow_dispatch as {
      inputs: Record<string, {default?: boolean; type?: string}>
    }
    const job = updateMembers.jobs.update
    const steps = job.steps
    const checkoutStep = steps.find(step => step.name === 'Checkout')
    const summaryStep = steps.find(
      step => step.name === 'Summarize member update'
    )
    const createPullRequestStep = steps.find(
      step => step.name === 'Create draft pull request'
    )

    assert.equal(workflowDispatch.inputs['draft-run'].default, false)
    assert.equal(workflowDispatch.inputs['draft-run'].type, 'boolean')
    assert.equal(
      job.environment,
      "${{ github.event.inputs['draft-run'] == 'true' && 'read' || 'push' }}"
    )
    assert.ok(checkoutStep)
    assert.equal(checkoutStep.if, "github.event.inputs['draft-run'] == 'true'")
    assert.ok(summaryStep)
    assert.match(summaryStep.run ?? '', /## Update members/)
    assert.match(
      summaryStep.run ?? '',
      /Pull request: not created because draft run is enabled/
    )
    assert.match(
      summaryStep.run ?? '',
      /git diff -- "github\/\$\{ORGANIZATION\}\.yml"/
    )
    assert.ok(createPullRequestStep)
    assert.equal(
      createPullRequestStep.if,
      "steps.config-modified.outputs.this == 'true' && github.event.inputs['draft-run'] != 'true'"
    )
  })
})
