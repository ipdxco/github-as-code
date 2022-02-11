terraform {
  backend "s3" {}

  required_providers {
    github = {
      source  = "integrations/github"
      version = "4.19.2"
    }
  }

  required_version = "~> 1.1.4"
}
