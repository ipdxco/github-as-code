import * as fs from 'fs'
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
})
