#!/bin/bash

set -e
set -u
set -o pipefail
# set -x

if [[ " $@ " == ' -h ' || " $@ " == ' --help ' || " $@ " =~ ' -help ' ]]; then
  echo "Usage: $0 [options] [path]"
  echo ''
  echo 'This script synchronizes organization files with the remote GitHub state.'
  echo 'If no path is specified, it will use the current directory.'
  echo 'It will execute terraform in the current directory either way.'
  echo ''
  echo 'WARNING: It performs writes to the terraform state!'
  echo 'WARNING: It performs writes to files tracked by git!'
  echo ''
  echo 'Options:'
  echo '  -h | -help | --help: Show this help output.'
  echo ''
  echo 'Examples:'
  echo "  $0"
  echo "  $0 ."
  echo "  $0 -help"
  exit 0
fi

at_address () {
  jq 'try(.values.root_module.resources) // [] + try(.values.root_module.child_modules | map(.resources) | add) // [] | map(select(.address | startswith($address)))' --arg address "$1" <<< "$2"
}

root="$(realpath "$(dirname "$0")/..")"

pushd "$root/terraform"

organization="$(terraform workspace show)"

separator="$(cat "$root/terraform/locals.tf" | tr -d '\n' | grep -oP 'separator\s*=\s*"\K[^"]*')"
resources="$(jq 'split(" ")[:-1] | map(sub(".json$"; ""))' <<< '"'"$(ls "$root/github/$organization" | tr '\n' ' ')"'"')"
resource_targets="$(jq -r 'map("-target=github_\(.).this") | join(" ")' <<< "$resources")"

data_targets="[]"
while read resource; do
  data="$(cat "$root/terraform/data.tf" | tr -d '[:space:]' | grep -oP '#@resources.'"$resource"'.datadata"\K.*?"' | tr -d '[:space:]')"
  data="$(jq 'split("\"")' <<< '"'"${data:0:-1}"'"')"
  data_targets="$(jq '$data + .' --argjson data "$data" <<< "$data_targets")"
done <<< "$(jq -r '.[]' <<< "$resources")"
data_targets="$(jq -r 'unique | map("-target=data.\(.).this") | join(" ")' <<< "$data_targets")"

echo "Refreshing resources"
terraform refresh $resource_targets
echo "Applying data changes"
terraform apply $data_targets -auto-approve

echo "Retrieving state"
state="$(terraform show -json)"
echo "Retrieving output"
output="$(terraform output -json)"

while read resource; do
  echo "Importing $resource"

  echo "Retrieving existing indices from state"
  existing_indices="$(at_address "github_$resource.this" "$state" | jq 'map(.index)')"
  echo "Retrieving all indices from outputs"
  remote_data="$(jq '.[$resource].value' --arg resource "$resource" <<< "$output")"
  remote_indices="$(jq 'map(.index)' <<< "$remote_data")"

  while read index; do
    if [[ ! -z "$index" ]]; then
      id="$(jq -r 'map(select(.index == $index)) | .[0].id' --argjson index "$index" <<< "$remote_data")"

      echo "Importing $index ($id)"
      terraform import "github_$resource.this[$index]" "$id"
    fi
  done <<< "$(jq '. - $existing_indices | .[]' --argjson existing_indices "$existing_indices" <<< "$remote_indices")"

  while read index; do
    if [[ ! -z "$index" ]]; then
      echo "Removing $index"
      terraform state rm "github_$resource.this[$index]"
    fi
  done <<< "$(jq '. - $remote_indices | .[]' --argjson remote_indices "$remote_indices" <<< "$existing_indices")"
done <<< "$(jq -r '.[]' <<< "$resources")"

echo "Retrieving state"
state="$(terraform show -json)"

while read resource; do
  required="$(cat "$root/terraform/resources.tf" | tr -d '[:space:]' | grep -oP '#@resources.'"$resource"'.required\K.*?=' | tr -d '[:space:]')"
  required="$(jq 'split("=")' <<< '"'"${required:0:-1}"'"')"
  ignore_changes="$(cat "$root/terraform/resources_override.tf" | tr -d '[:space:]' | grep -oP '#@resources.'"$resource"'.ignore_changesignore_changes=\K.*?[^0]\]' | tr -d '[:space:]')"
  if [[ -z "$ignore_changes" ]]; then
    ignore_changes="$(cat "$root/terraform/resources.tf" | tr -d '[:space:]' | grep -oP '#@resources.'"$resource"'.ignore_changesignore_changes=\K.*?[^0]\]' | tr -d '[:space:]')"
  fi
  ignore_changes="$(jq 'split(",") | map(select(startswith("#") | not))' <<< '"'"${ignore_changes:1:-1}"'"')"
  ignore="$(echo "$required" "$ignore_changes" | jq -s 'add')"
  ignore_string="$(jq -r 'map(".\(.)") | join(", ")' <<< "$ignore")"

  echo "Retrieving resources from state"
  resource_config="$(at_address "github_$resource.this" "$state" | jq 'map({"key": .index, "value": .values}) | from_entries')"

  echo "Ignoring ignored and required arguments"
  resource_config="$(jq "map_values(del($ignore_string))" <<< "$resource_config")"

  if (( $(jq 'length' <<< "$required") > 1 )); then
    echo "Breaking up top level keys"
    resource_config="$(jq 'to_entries |
      map(.key |= split($separator)) |
      map({"key": .key[0], "value": {"key": .key[1], "value": .value}}) |
      group_by(.key) |
      map({"key": .[0].key, "value": map(.value) | from_entries}) |
      from_entries' --arg separator "$separator" <<< "$resource_config")"
  fi

  echo "Saving new resource configuration"
  jq '.' <<< "$resource_config" > "$root/github/$organization/$resource.json"
done <<< "$(jq -r '.[]' <<< "$resources")"

echo "Done"
popd
