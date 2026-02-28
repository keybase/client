## Release

[![Build Status](https://github.com/keybase/client/go/release/actions/workflows/ci.yml/badge.svg)](https://github.com/keybase/client/go/release/actions)
[![GoDoc](https://godoc.org/github.com/keybase/client/go/release?status.svg)](https://godoc.org/github.com/keybase/client/go/release)

This is a command line tool for build and release scripts for generating updates, interacting with Github and S3.

### Example Usage

Generating update.json

```
release update-json --version=1.2.3 --src=/tmp/Keybase.zip --uri=https://s3.amazonaws.com/prerelease.keybase.io/darwin-updates --signature=/tmp/keybase.sig
```
