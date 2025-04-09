import fs from 'fs'
import HCL from 'hcl2-parser'

type LocalsSchema = {
  resource_types: string[]
}

export class Locals {
  static locals: LocalsSchema
  static getLocals(): LocalsSchema {
    if (Locals.locals === undefined) {
      const locals: LocalsSchema = {
        resource_types: []
      }
      for (const path of [
        `${process.env.TF_WORKING_DIR}/locals.tf`,
        `${process.env.TF_WORKING_DIR}/locals_override.tf`
      ]) {
        if (fs.existsSync(path)) {
          const hcl = HCL.parseToObject(fs.readFileSync(path))?.at(0)
          for (const key of Object.keys(locals)) {
            const value = hcl?.locals?.at(0)?.[key]
            if (value !== undefined) {
              locals[key as keyof LocalsSchema] = value
            }
          }
        }
      }
      this.locals = locals
    }
    return Locals.locals
  }
}
