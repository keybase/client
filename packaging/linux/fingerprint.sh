#! /usr/bin/env bash

set -e -u -o pipefail

here="$(dirname "${BASH_SOURCE[0]}")"

if [ "${KEYBASE_TEST_CODE_SIGNING_KEY:-}" = "1" ]; then
    cat "$here/test_code_signing_fingerprint"
else
    cat "$here/code_signing_fingerprint"
fi
