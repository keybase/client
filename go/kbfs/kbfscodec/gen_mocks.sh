#!/usr/bin/env bash

go tool mockgen -package="kbfscodec" -self_package=github.com/keybase/client/go/kbfs/kbfscodec -source=codec.go > mock_codec.go
go fmt mock_codec.go
