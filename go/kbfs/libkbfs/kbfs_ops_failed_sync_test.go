// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

type bserverFailPuts struct {
	BlockServer
	fail atomic.Bool
}

func (b *bserverFailPuts) Put(ctx context.Context, tlfID tlf.ID,
	id kbfsblock.ID, bctx kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	cacheType DiskBlockCacheType,
) error {
	if b.fail.Load() {
		return kbfsblock.ServerErrorUnauthorized{Msg: "Token expired"}
	}
	return b.BlockServer.Put(ctx, tlfID, id, bctx, buf, serverHalf, cacheType)
}

// A sync that fails on a block put must leave a new directory readable,
// so the directory can still be listed and the sync retried.
func TestKBFSOpsNewDirReadableAfterFailedBlockPut(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocksNoCheck(ctx, t, config, cancel)

	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)
	kbfsOps := config.KBFSOps()

	dirNode, _, err := kbfsOps.CreateDir(ctx, rootNode, testPPS("d"))
	require.NoError(t, err)

	failing := &bserverFailPuts{BlockServer: config.BlockServer()}
	failing.fail.Store(true)
	config.SetBlockServer(failing)

	_, _, err = kbfsOps.CreateFile(ctx, dirNode, testPPS("f"), false, WithExcl)
	require.Error(t, err)

	children, err := kbfsOps.GetDirChildren(ctx, dirNode)
	require.NoError(t, err, "listing the new directory after a failed sync")
	require.Empty(t, children)

	rootChildren, err := kbfsOps.GetDirChildren(ctx, rootNode)
	require.NoError(t, err)
	require.Contains(t, rootChildren, testPPS("d"))

	failing.fail.Store(false)
	_, _, err = kbfsOps.CreateFile(ctx, dirNode, testPPS("f"), false, WithExcl)
	require.NoError(t, err)
	children, err = kbfsOps.GetDirChildren(ctx, dirNode)
	require.NoError(t, err)
	require.Contains(t, children, testPPS("f"))
}
