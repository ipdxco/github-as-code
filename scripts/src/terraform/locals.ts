import fs from 'fs'
import HCL from 'hcl2-parser'

type LocalsSchema = {
  resource_types: string[]
  ignore: {
    repositories: string[]
    teams: string[]
    users: string[]
  }
}

export class Locals {
  static locals: LocalsSchema
  static getLocals(): LocalsSchema {
    if (Locals.locals === undefined) {
      const locals: LocalsSchema = {
        resource_types: [],
        ignore: {
          repositories: [],
          teams: [],
          users: []
        }
      }
      for (const path of [
        `${process.env.TF_WORKING_DIR}/locals.tf`,
        `${process.env.TF_WORKING_DIR}/locals_override.tf`
      ]) {
        if (fs.existsSync(path)) {
          const hcl =
            HCL.parseToObject(fs.readFileSync(path))?.at(0)?.locals?.at(0) ?? {}
          locals.resource_types = hcl.resource_types ?? locals.resource_types
          locals.ignore.repositories =
            hcl.ignore?.repositories ?? locals.ignore.repositories
          locals.ignore.teams = hcl.ignore?.teams ?? locals.ignore.teams
          locals.ignore.users = hcl.ignore?.users ?? locals.ignore.users
        }
      }
      this.locals = locals
    }
    return Locals.locals
  }
}
