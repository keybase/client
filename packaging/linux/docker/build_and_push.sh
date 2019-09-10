#!/usr/bin/env bash
set -euxo pipefail

build_dir="$1"
here="$(dirname "$BASH_SOURCE")"
client_dir="$(git -C "$here" rev-parse --show-toplevel)"
source_commit="$(git -C "$here" log -1 --pretty=format:%h)"
tag="$(cat "$build_dir/VERSION" | tr "+" "-")"

# Clear the directory used for temporary, just in case a previous build failed
rm -r $client_dir/.docker || true
mkdir -p $client_dir/.docker
code_signing_fingerprint="$(cat "$here/../code_signing_fingerprint")"
gpg_tempfile="$client_dir/.docker/code_signing_key"
gpg --export-secret-key --armor "$code_signing_fingerprint" > "$gpg_tempfile"

# Build all three variants
docker build \
  --build-arg SOURCE_COMMIT="$source_commit" \
  --build-arg SIGNING_FINGERPRINT="$code_signing_fingerprint" \
  -f $client_dir/packaging/linux/docker/standard/Dockerfile \
  -t "keybaseio/client:$tag" \
  $client_dir

docker build \
  --build-arg BASE_IMAGE="keybaseio/client:$tag" \
  -f $client_dir/packaging/linux/docker/slim/Dockerfile \
  -t "keybaseio/client:$tag-slim" \
  $client_dir

# Don't store any secrets in the repo dir
rm -r $client_dir/.docker || true

# Push it (TODO Y2K-607)
#docker tag keybaseio/client:$tag keybaseio/client:nightly
#docker push keybaseio/client:$tag
#docker push keybaseio/client:nightly
#docker tag keybaseio/client:$tag-slim keybaseio/client:nightly-slim
#docker push keybaseio/client:$tag-slim
#docker push keybaseio/client:nightly-slim
