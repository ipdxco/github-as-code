terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "4.23.0"
    }
  }

  required_version = "~> 1.1.4"
}
