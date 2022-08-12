import * as YAML from 'yaml'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonEquals(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function yamlify(value: any): YAML.ParsedNode {
  const node = YAML.parseDocument(YAML.stringify(value)).contents
  if (node === null) {
    throw new Error(
      `Failed to parse YAML to a non-null value: ${YAML.stringify(value)}`
    )
  }
  return node
}
