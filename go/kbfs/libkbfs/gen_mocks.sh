#!/usr/bin/env bash

function gen {
    srcPkg=$1
    dst=$2
    symbols=$3

    tmp=$(mktemp)
    mockgen --package="libkbfs" \
        --self_package github.com/keybase/client/go/kbfs/libkbfs \
        $srcPkg $symbols > $tmp
    dstFile=${dst}_mocks_test.go
    mv $tmp $dstFile
    go fmt $dstFile
}

gen github.com/keybase/client/go/kbfs/libkey libkey \
KeyOps,\
KeyServer

gen github.com/keybase/client/go/kbfs/data data \
BlockCache,\
BlockSplitter,\
BlockWithPtrs,\
DirtyBlockCache

gen github.com/keybase/client/go/kbfs/libkbfs libkbfs \
BlockOps,\
BlockServer,\
Chat,\
Clock,\
Crypto,\
KBFSOps,\
KBPKI,\
KeybaseService,\
KeyCache,\
KeyManager,\
MDCache,\
MDOps,\
MDServer,\
Node,\
NodeCache,\
NodeID,\
Notifier,\
RekeyQueue,\
Reporter,\
SubscriptionNotifier,\
SubscriptionManagerPublisher
