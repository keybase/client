#!/usr/bin/env bash

function gen {
    srcPkg=$1
    dst=$2
    symbols=$3

    tmp=$(mktemp)
    mockgen --package="data" \
        --self_package github.com/keybase/client/go/kbfs/data \
        $srcPkg $symbols > $tmp
    dstFile=${dst}_mocks_test.go
    mv $tmp $dstFile
    go fmt $dstFile
}

gen github.com/keybase/client/go/kbfs/data data BlockWithPtrs
