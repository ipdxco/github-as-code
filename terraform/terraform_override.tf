terraform {
  backend "s3" {
    region               = "us-west-2"
    bucket               = "github-mgmt"
    key                  = "terraform.tfstate"
    workspace_key_prefix = "org"
    dynamodb_table       = "github-mgmt"
  }
}
