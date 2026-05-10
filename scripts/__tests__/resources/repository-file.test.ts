import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {findFileByContent} from '../../src/resources/repository-file.js'
import {describe, it} from 'node:test'
import assert from 'node:assert'

describe('repository file', () => {
  it('finds file by content', async () => {
    const filePath = '__tests__/__resources__/files/README.md'
    const fileContent = fs.readFileSync(filePath).toString()
    const foundFilePath = findFileByContent(
      '__tests__/__resources__',
      fileContent
    )
    assert.equal(foundFilePath, filePath)
  })

  it('does not follow paths outside the base directory', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-file-'))
    const outsideDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'repository-file-')
    )
    try {
      fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret')
      fs.symlinkSync(outsideDir, path.join(baseDir, 'outside'), 'dir')

      const foundFilePath = findFileByContent(baseDir, 'secret')

      assert.equal(foundFilePath, undefined)
    } finally {
      fs.rmSync(baseDir, {recursive: true, force: true})
      fs.rmSync(outsideDir, {recursive: true, force: true})
    }
  })
})
