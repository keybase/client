#!/usr/bin/env bash
set -Eeuxo pipefail

here="$(dirname "${BASH_SOURCE[0]}")"
client_dir="$(git -C "$here" rev-parse --show-toplevel)"

# Force correct usage
if [ -z "${1:-}" ] || [ "${2:-}" != "nightly" ] && [ "${2:-}" != "release" ]; then
  echo "FAIL: Invalid arguments"
  echo "Usage: ./push.sh <tag> [nightly|release]"
  exit 1
fi
tag="$1"
kind="$2"

# Log into Docker Hub
trap "docker logout || true" ERR
docker login --username "$DOCKERHUB_USERNAME" --password-stdin <<< "$DOCKERHUB_PASSWORD" &> /dev/null

# Load up all the config we need
config_file="$client_dir/packaging/linux/docker/config.json"
image_name="$(jq -r '.image_name' "$config_file")"
readarray -t variants <<< "$(jq -r '.variants | keys | .[]' "$config_file")"

# Instructions is an array of strings, where the value has the format of `[src],[target]`.
# The [target] part can be empty, which makes it a simple push.
instructions=()

# We always push the base tags.
for variant in "${variants[@]}"; do
  instructions+=("$image_name:$tag$variant,")
done

if [ "$kind" = "nightly" ]; then
  # Nightly builds also get released as `$image_name:nightly$variant`
  for variant in "${variants[@]}"; do
    instructions+=("$image_name:$tag$variant,$image_name:nightly$variant")
  done
elif [ "$kind" = "release" ]; then
  # Release builds end up as:
  # - `$image_name:latest$variant`
  # - `$image_name:stable$variant`
  # - `$image_name:$version$variant`, where $version is the first item of a dash-split tag arg
  for variant in "${variants[@]}"; do
    IFS='-' read -ra tagParts <<< "$tag"
    version="${tagParts[0]}"

    instructions+=(
      "$image_name:$tag$variant,$image_name:latest$variant"
      "$image_name:$tag$variant,$image_name:stable$variant"
      "$image_name:$tag$variant,$image_name:$version$variant"
    )
  done
fi

# Given the list of instructions, do the pushing
results=()
for instruction in "${instructions[@]}"; do
  IFS=','; read -ra parts <<< "$instruction"
  source="${parts[0]:-}"
  target="${parts[1]:-${parts[0]}}"

  # Always check if the image exists.
  if [[ "$(docker images -q "$source" 2> /dev/null)" == "" ]]; then
    echo "FAIL: Image $source does not exist"
    exit 1
  fi

  # Tag if it was requested
  if [ "$source" != "$target" ]; then
    if ! tagOutput="$(docker tag "$source" "$target" 2>&1)"; then
      echo "Tagging $source as $target failed:"
      echo "$tagOutput"
      exit 1
    fi
  fi

  if ! pushOutput="$(docker push "$target" 2>&1)"; then
    echo "Pushing $target failed:"
    echo "$pushOutput"
    exit 1
  fi

  results+=("$target")
done

echo "Released Docker tag $tag, available as the following images:" "${results[@]}"
