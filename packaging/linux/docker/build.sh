#!/usr/bin/env bash
set -Eeuxo pipefail

here="$(dirname "${BASH_SOURCE[0]}")"
client_dir="$(git -C "$here" rev-parse --show-toplevel)"
source_commit="$(git -C "$here" log -1 --pretty=format:%h)"
tag="$(echo "$1" | tr "+" "-")"

# Clear the directory used for temporary, just in case a previous build failed
rm -r "$client_dir/.docker" || true
mkdir -p "$client_dir/.docker"
binary_dest_dir="$client_dir/.docker/binaries/amd64"
mkdir -p "$binary_dest_dir" 
code_signing_fingerprint="$("$here/../fingerprint.sh")"
gpg_tempfile="$client_dir/.docker/code_signing_key"
gpg --export-secret-key --armor "$code_signing_fingerprint" > "$gpg_tempfile"

# Don't store any secrets in the repo dir
trap "rm -r ""$client_dir/.docker"" || true" ERR

# Load up all the config we need now, the rest will be resolved as needed
config_file="$client_dir/packaging/linux/docker/config.json"
image_name="$(jq -r '.image_name' "$config_file")"
readarray -t variants <<< "$(jq -r '.variants | keys | .[]' "$config_file")"

builder_name="keybaseio/dockerimage-builder:v1" 
docker build --pull \
  --build-arg SOURCE_COMMIT="$source_commit" \
  --build-arg SIGNING_FINGERPRINT="$code_signing_fingerprint" \
  -f "$client_dir/packaging/linux/docker/Dockerfile" \
  -t "$builder_name" "$client_dir"

id=$(docker create "$builder_name")
docker cp $id:/binaries/amd64/usr/bin/keybase "$binary_dest_dir"
docker cp $id:/binaries/amd64/usr/bin/keybase.sig "$binary_dest_dir"
docker cp $id:/binaries/amd64/usr/bin/kbfsfuse "$binary_dest_dir"
docker cp $id:/binaries/amd64/usr/bin/kbfsfuse.sig "$binary_dest_dir"
docker cp $id:/binaries/amd64/usr/bin/git-remote-keybase "$binary_dest_dir" 
docker cp $id:/binaries/amd64/usr/bin/git-remote-keybase.sig "$binary_dest_dir"
docker rm -v $id

# We assume that the JSON file is correctly ordered
for variant in "${variants[@]}"; do
  base_variant="$(jq -r ".variants.\"$variant\".base" "$config_file")"
  dockerfile="$(jq -r ".variants.\"$variant\".dockerfile" "$config_file")"

  if [ "$base_variant" = "null" ]; then
    docker build \
      --pull \
      --platform=linux/amd64 \
      --build-arg SOURCE_COMMIT="$source_commit" \
      --build-arg SIGNING_FINGERPRINT="$code_signing_fingerprint" \
      -f "$client_dir/$dockerfile" \
      -t "$image_name:$tag$variant" \
      "$client_dir"
  else
    docker build \
      --platform=linux/amd64 \
      --build-arg BASE_IMAGE="$image_name:$tag$base_variant" \
      -f "$client_dir/$dockerfile" \
      -t "$image_name:$tag$variant" \
      "$client_dir"
  fi
done
