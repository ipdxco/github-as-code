terraform {
  required_providers {
    github = {
      source  = "registry.terraform.io/integrations/github"
      version = "5.25.2-rc9"
    }
  }

  # https://github.com/hashicorp/terraform/issues/32329
  required_version = "~> 1.2.9"
}
