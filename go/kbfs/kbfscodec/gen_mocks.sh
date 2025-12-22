#!/usr/bin/env bash

go tool mockgen -package="kbfscodec" -source=codec.go > mock_codec.go
go fmt mock_codec.go
