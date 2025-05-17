terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.6.0"
    }
  }

  # https://github.com/hashicorp/terraform/issues/32329
  required_version = "~> 1.12.0"
}
