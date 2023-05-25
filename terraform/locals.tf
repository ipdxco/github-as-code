locals {
  organization      = terraform.workspace
  config            = yamldecode(file("${path.module}/../github/${local.organization}.yml"))
  resource_types    = []
  advanced_security = false
}
