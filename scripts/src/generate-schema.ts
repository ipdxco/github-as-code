import 'reflect-metadata'
import * as gen from 'ts-json-schema-generator'
import * as fs from 'fs'

class StringLikeDefinitionTypeFormatter implements gen.SubTypeFormatter {
  public supportsType(type: gen.BaseType): boolean {
    return type instanceof gen.DefinitionType &&
      ["Member", "TeamMember", "RepositoryCollaborator", "RepositoryTeam"].includes(type.getName())
  }

  public getDefinition(type: gen.BaseType): gen.Definition {
    return {
      type: "string"
    }
  }

  public getChildren(type: gen.BaseType): gen.BaseType[] {
    return []
  }
}

function run(): void {
  const config = {
    path: "src/schema.ts",
    tsconfig: "tsconfig.json",
    type: "Schema"
  }

  const formatter = gen.createFormatter(config, fmt => fmt.addTypeFormatter(new StringLikeDefinitionTypeFormatter()))
  const program = gen.createProgram(config)
  const parser = gen.createParser(program, config)
  const generator = new gen.SchemaGenerator(program, parser, formatter, config)
  const schema = generator.createSchema(config.type)

  const schemaString = JSON.stringify(schema, null, 2)
  fs.writeFileSync("../github/.schema.json", schemaString)
}

run()
