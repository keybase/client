#!/usr/bin/env bash

mockgen -package="libkbfs" -source=interfaces.go > mocks_test.go
