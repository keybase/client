#!/usr/bin/env bash
set -euxo pipefail

build_dir="$1"
here="$(dirname "$BASH_SOURCE")"
client_dir="$(git -C "$here" rev-parse --show-toplevel)"
source_commit="$(git -C "$here" log -1 --pretty=format:%h)"
code_signing_fingerprint="$(cat "$here/../code_signing_fingerprint")"
armored_private_key="$(gpg --export-secret-keys)"
tag="$(cat "$build_dir/VERSION" | tr "+" "-")"

# Build all three variants
docker build \
  --build-arg SOURCE_COMMIT="$source_commit" \
  --build-arg SIGNING_FINGERPRINT="$code_signing_fingerprint" \
  --build-arg ARMORED_PRIVATE_KEY="$armored_private_key" \
  -f $client_dir/packaging/linux/docker/service/Dockerfile \
  -t "keybaseio/service:$tag" \
  $client_dir

docker build \
  --build-arg SERVICE_IMAGE="keybaseio/service:$tag" \
  -f $client_dir/packaging/linux/docker/client/Dockerfile \
  -t "keybaseio/client:$tag" \
  $client_dir

docker build \
  --build-arg SERVICE_IMAGE="keybaseio/service:$tag" \
  -f $client_dir/packaging/linux/docker/client-slim/Dockerfile \
  -t "keybaseio/client:$tag-slim" \
  $client_dir

# Push it (TODO Y2K-607)
#docker tag keybaseio/client:$tag keybaseio/client:nightly
#docker push keybaseio/client:$tag
#docker push keybaseio/client:nightly
#docker tag keybaseio/client:$tag-slim keybaseio/client:nightly-slim
#docker push keybaseio/client:$tag-slim
#docker push keybaseio/client:nightly-slim
#docker tag keybaseio/service:$tag keybaseio/service:nightly
#docker push keybaseio/service:$tag
#docker push keybaseio/service:nightly
