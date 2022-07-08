data "github_organization_teams" "this" {
  count = length(setintersection(
    toset(["github_team"]),
    toset(local.resource_types)
  )) == 0 ? 0 : 1
}
