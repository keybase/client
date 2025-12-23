#!/usr/bin/env bash


tmp=$(mktemp)
go tool mockgen -package="kbfscodec" -self_package=github.com/keybase/client/go/kbfs/kbfscodec -source=codec.go > "$tmp"
mv "$tmp" mock_codec.go
go fmt mock_codec.go
