import * as YAML from 'yaml'

export function jsonEquals(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function yamlify(value: any): YAML.ParsedNode {
  return YAML.parseDocument(YAML.stringify(value)).contents!
}
