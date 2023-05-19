terraform {
  required_providers {
    github = {
      source  = "github.com/galargh/terraform-provider-github"
      version = "5.25.2-rc1"
    }
  }

  # https://github.com/hashicorp/terraform/issues/32329
  required_version = "~> 1.2.9"
}
