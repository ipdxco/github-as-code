import * as fs from 'fs'
import {camelCaseToSnakeCase, findFileByContent} from '../src/utils'

test('turns camel case into snake case', async () => {
  expect(camelCaseToSnakeCase('UpperCamelCase')).toEqual('upper_camel_case')
})

test('finds file by content', async () => {
  const filePath = '__tests__/resources/files/README.md'
  const fileContent = fs.readFileSync(filePath).toString()
  const foundFilePath = findFileByContent('__tests__/resources', fileContent)
  expect(foundFilePath).toEqual(filePath)
})
