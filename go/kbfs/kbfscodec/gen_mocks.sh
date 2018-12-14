#!/usr/bin/env bash

mockgen -package="kbfscodec" -source=codec.go > mock_codec.go
go fmt mock_codec.go
