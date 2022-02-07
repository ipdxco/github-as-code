locals {
  separator    = " → "
  organization = terraform.workspace
  github = {
    for file in fileset("${path.module}/../github/${local.organization}", "*.json") :
    trimsuffix(file, ".json") => jsondecode(file("${path.module}/../github/${local.organization}/${file}"))
  }
}
