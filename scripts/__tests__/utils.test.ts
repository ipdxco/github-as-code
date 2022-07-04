import { camelCaseToSnakeCase } from "../src/utils"

test('turns camel case into snake case', async () => {
  expect(camelCaseToSnakeCase('UpperCamelCase')).toEqual('upper_camel_case')
})
