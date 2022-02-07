terraform {
  backend "remote" {
    hostname     = "app.terraform.io"
    organization = "galargh"

    workspaces {
      prefix = "org_"
    }
  }

  required_providers {
    github = {
      source  = "integrations/github"
      version = "4.19.2"
    }
  }

  required_version = "~> 1.1.4"
}
