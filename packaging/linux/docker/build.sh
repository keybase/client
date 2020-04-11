#!/usr/bin/env bash
set -Eeuxo pipefail

here="$(dirname "${BASH_SOURCE[0]}")"
client_dir="$(git -C "$here" rev-parse --show-toplevel)"
source_commit="$(git -C "$here" log -1 --pretty=format:%h)"
tag="$(echo "$1" | tr "+" "-")"

# Clear the directory used for temporary, just in case a previous build failed
rm -r "$client_dir/.docker" || true
mkdir -p "$client_dir/.docker"
code_signing_fingerprint="$("$here/../fingerprint.sh")"
gpg_tempfile="$client_dir/.docker/code_signing_key"
gpg --export-secret-key --armor "$code_signing_fingerprint" > "$gpg_tempfile"

# Don't store any secrets in the repo dir
trap "rm -r ""$client_dir/.docker"" || true" ERR

# Load up all the config we need now, the rest will be resolved as needed
configFile="$client_dir/packaging/linux/docker/config.json"
imageName="$(jq -r '.imageName' "$configFile")"
readarray -t variants <<< "$(jq -r '.variants | keys | .[]' "$configFile")"

# We assume that the JSON file is correctly ordered
for variant in "${variants[@]}"; do
  baseKey="$(jq -r ".variants.\"$variant\".base" config.json)"
  dockerfile="$(jq -r ".variants.\"$variant\".dockerfile" config.json)"

  if [ "$baseKey" = "null" ]; then
    sudo docker build \
      --pull \
      --build-arg SOURCE_COMMIT="$source_commit" \
      --build-arg SIGNING_FINGERPRINT="$code_signing_fingerprint" \
      -f "$client_dir/$dockerfile" \
      -t "$imageName:$tag" \
      "$client_dir"
  else
    sudo docker build \
      --pull \
      --build-arg BASE_IMAGE="$imageName:$tag" \
      -f "$client_dir/$dockerfile" \
      -t "$imageName:$tag" \
      "$client_dir"
  fi
done
