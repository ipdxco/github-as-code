locals {
  organization      = terraform.workspace
  config            = yamldecode(file("${path.module}/../github/${local.organization}.yml"))
  state             = {
    for resource in jsondecode(file("${path.module}/${local.organization}.tfstate.json")).values.root_module.resources :
      "${resource.mode}.${resource.type}.${resource.name}.${resource.index}" => merge(resource.values, {"index" = resource.index})
  }
  resource_types    = []
  advanced_security = false
}
