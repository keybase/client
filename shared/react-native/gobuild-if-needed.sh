#!/usr/bin/env bash
#
# Runs gobuild.sh only when the prebuilt Go framework is missing or older than
# the Go sources it was built from.
#
#   ./gobuild-if-needed.sh ios|android
#
# Why this exists: keybasego.xcframework / keybaselib.aar are gitignored build
# artifacts, so they never arrive with a branch. Checking out a branch that adds
# an exported func to go/bind leaves the on-disk artifact without the
# declaration, and the native build fails with an error that names a missing C
# identifier and gives no hint that a Go rebuild is the answer:
#
#   Kb.mm:394: error: use of undeclared identifier 'KeybaseResetIfCurrentDidReset'
#
# Escape hatches:
#   KB_SKIP_GOBUILD=1   never build, even if stale (packaging/CI paths that
#                       supply the artifact by other means)
#   KB_FORCE_GOBUILD=1  always build
#
# Any flag that changes the output (see KB_GO_DEBUG in gobuild.sh) is recorded
# in the stamp, so flipping it forces a rebuild rather than silently reusing an
# artifact built with different settings.
set -e -u -o pipefail

dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
client_dir="$dir/../.."

arg=${1:-}
if [[ "$arg" != "ios" && "$arg" != "android" ]]; then
	echo "usage: $(basename "$0") ios|android" >&2
	exit 1
fi

if [[ -n ${KB_SKIP_GOBUILD:-} && "${KB_SKIP_GOBUILD}" != "0" ]]; then
	echo "gobuild-if-needed: KB_SKIP_GOBUILD set, skipping"
	exit 0
fi

if [ "$arg" = "ios" ]; then
	dest=${DEST_DIR:-"$client_dir/shared/ios"}/keybasego.xcframework
	# Inside the artifact, so it inherits the artifact's gitignore entry and
	# disappears whenever the artifact is deleted.
	stamp="$dest/.gobuild-stamp"
else
	dest=${DEST_DIR:-"$client_dir/shared/android/keybaselib"}/keybaselib.aar
	stamp="$(dirname "$dest")/.gobuild-stamp"
fi

# Building under a sanitizer scheme implies wanting the Go-side checks too.
# Xcode exports its build settings to script phases, and enabling a sanitizer
# sets these; the plain Keybase scheme leaves them unset. (A scheme's
# EnvironmentVariables cannot do this job -- those belong to the LaunchAction
# and only exist when the app runs, long after this script has.)
# An explicit KB_GO_DEBUG always wins, including KB_GO_DEBUG=0 to opt out.
if [ -z "${KB_GO_DEBUG:-}" ]; then
	if [ "${ENABLE_ADDRESS_SANITIZER:-NO}" = "YES" ] ||
		[ "${ENABLE_THREAD_SANITIZER:-NO}" = "YES" ]; then
		echo "gobuild-if-needed: sanitizer build detected, enabling KB_GO_DEBUG"
		export KB_GO_DEBUG=1
	fi
fi

# Everything that changes what gomobile emits. TAGS and TARGETS are read by
# gobuild.sh; KB_GO_DEBUG switches on the cgo/pointer checks. KB_GO_DEBUG is in
# the signature so switching between a sanitizer scheme and the plain one
# rebuilds rather than silently reusing the other's artifact.
signature="tags=${TAGS:-default} targets=${TARGETS:-default} godebug=${KB_GO_DEBUG:-0}"

needs_build=""
if [[ -n ${KB_FORCE_GOBUILD:-} && "${KB_FORCE_GOBUILD}" != "0" ]]; then
	needs_build="KB_FORCE_GOBUILD set"
elif [ ! -e "$dest" ]; then
	needs_build="$(basename "$dest") missing"
elif [ ! -f "$stamp" ]; then
	# Artifact built before this script existed, or by a bare gobuild.sh run.
	# Cannot tell whether it is current, so rebuild once and stamp it.
	needs_build="no build stamp"
elif [ "$(cat "$stamp")" != "$signature" ]; then
	needs_build="build settings changed"
else
	# -print -quit stops at the first hit, so the common (up-to-date) case walks
	# only until it finds nothing rather than scanning the whole tree.
	newer=$(find "$client_dir/go" \
		-name vendor -prune -o \
		\( -name '*.go' -o -name 'go.mod' -o -name 'go.sum' \) \
		-newer "$stamp" -print -quit)
	if [ -n "$newer" ]; then
		needs_build="$(basename "$newer") is newer"
	fi
fi

if [ -z "$needs_build" ]; then
	echo "gobuild-if-needed: $arg artifact is up to date ($signature)"
	exit 0
fi

echo "gobuild-if-needed: rebuilding $arg ($needs_build)"
"$dir/gobuild.sh" "$arg"

# Stamp only after a successful build: a failed build must not look current.
mkdir -p "$(dirname "$stamp")"
printf '%s' "$signature" >"$stamp"
echo "gobuild-if-needed: $arg build complete"
