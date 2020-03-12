#!/usr/bin/env bash
set -euxo pipefail

here="$(dirname "${BASH_SOURCE[0]}")"
client_dir="$(git -C "$here" rev-parse --show-toplevel)"
source_commit="$(git -C "$here" log -1 --pretty=format:%h)"
tag="$(echo "$1" | tr "+" "-")"

# Clear the directory used for temporary, just in case a previous build failed
rm -r "$client_dir/.docker" || true
mkdir -p "$client_dir/.docker"
code_signing_fingerprint="$(cat "$here/../code_signing_fingerprint")"
gpg_tempfile="$client_dir/.docker/code_signing_key"
gpg --export-secret-key --armor "$code_signing_fingerprint" > "$gpg_tempfile"

# Clear all existing base images
docker rmi golang:1.13.7-stretch || true
docker rmi debian:stretch || true

# Build all three variants
docker build \
  --build-arg SOURCE_COMMIT="$source_commit" \
  --build-arg SIGNING_FINGERPRINT="$code_signing_fingerprint" \
  -f "$client_dir/packaging/linux/docker/standard/Dockerfile" \
  -t "keybaseio/client:$tag" \
  "$client_dir"

docker build \
  --build-arg BASE_IMAGE="keybaseio/client:$tag" \
  -f "$client_dir/packaging/linux/docker/slim/Dockerfile" \
  -t "keybaseio/client:$tag-slim" \
  "$client_dir"

docker build \
  --build-arg BASE_IMAGE="keybaseio/client:$tag" \
  -f "$client_dir/packaging/linux/docker/node/Dockerfile" \
  -t "keybaseio/client:$tag-node" \
  "$client_dir"

docker build \
  --build-arg BASE_IMAGE="keybaseio/client:$tag" \
  -f "$client_dir/packaging/linux/docker/node-slim/Dockerfile" \
  -t "keybaseio/client:$tag-node-slim" \
  "$client_dir"

# Don't store any secrets in the repo dir
rm -r "$client_dir/.docker" || true
