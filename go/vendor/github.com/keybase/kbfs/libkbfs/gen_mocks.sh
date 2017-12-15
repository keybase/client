#!/usr/bin/env bash

mockgen -package="libkbfs" -source=interfaces.go > mocks_test.go
go fmt mocks_test.go
