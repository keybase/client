#!/usr/bin/env bash
set -euxo pipefail

build_dir="$1"
here="$(dirname "$BASH_SOURCE")"
client_dir="$(git -C "$here" rev-parse --show-toplevel)"
source_commit="$(git -C "$here" log -1 --pretty=format:%h)"
tag="$(cat "$build_dir/VERSION" | tr "+" "-")"

# Build all three variants
docker build \
  --build-arg SOURCE_COMMIT=$source_commit \
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

# Push it
docker push keybaseio/client:$tag
docker push keybaseio/client:$tag-slim
docker push keybaseio/service:$tag
