provider "github" {
  owner          = local.organization
  write_delay_ms = var.write_delay_ms
  app_auth {}
}
