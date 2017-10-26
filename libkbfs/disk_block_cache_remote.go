// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"net"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	kbgitkbfs "github.com/keybase/kbfs/protocol/kbgitkbfs"
	"github.com/keybase/kbfs/tlf"
)

type diskBlockCacheRemoteConfig interface {
	logMaker
}

// DiskBlockCacheRemote implements a client to access a remote
// DiskBlockCacheService. It implements the DiskBlockCache interface.
type DiskBlockCacheRemote struct {
	conn   net.Conn
	client kbgitkbfs.DiskBlockCacheClient
	log    traceLogger
}

var _ DiskBlockCache = (*DiskBlockCacheRemote)(nil)

// NewDiskBlockCacheRemote creates a new remote disk cache client.
func NewDiskBlockCacheRemote(kbCtx Context, config diskBlockCacheRemoteConfig) (
	*DiskBlockCacheRemote, error) {
	conn, xp, _, err := kbCtx.GetKBFSSocket(true)
	if err != nil {
		return nil, err
	}
	cli := rpc.NewClient(xp, KBFSErrorUnwrapper{},
		libkb.LogTagsFromContext)
	client := kbgitkbfs.DiskBlockCacheClient{Cli: cli}

	return &DiskBlockCacheRemote{
		conn:   conn,
		client: client,
		log:    traceLogger{config.MakeLogger("DBR")},
	}, nil
}

// Get implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Get(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID) (buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	prefetchStatus PrefetchStatus, err error) {
	dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Get %s", blockID)
	defer func() {
		dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Get %s done (err=%+v)", blockID, err)
	}()

	res, err := dbcr.client.GetBlock(ctx, kbgitkbfs.GetBlockArg{
		keybase1.TLFID(tlfID.String()),
		blockID.String(),
	})
	if err != nil {
		return buf, serverHalf, prefetchStatus, err
	}

	serverHalf, err = kbfscrypto.ParseBlockCryptKeyServerHalf(res.ServerHalf)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, prefetchStatus, err
	}

	return res.Buf, serverHalf, PrefetchStatus(res.PrefetchStatus), nil
}

// Put implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Put %s", blockID)
	defer func() {
		dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Put %s done (err=%+v)", blockID, err)
	}()

	return dbcr.client.PutBlock(ctx, kbgitkbfs.PutBlockArg{
		keybase1.TLFID(tlfID.String()),
		blockID.String(),
		buf,
		serverHalf.String(),
	})
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Delete(ctx context.Context,
	blockIDs []kbfsblock.ID) (numRemoved int, sizeRemoved int64, err error) {
	numBlocks := len(blockIDs)
	dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Delete %s block(s)",
		numBlocks)
	defer func() {
		dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Delete %s block(s) "+
			"done (err=%+v)", numBlocks, err)
	}()
	blocks := make([]string, 0, len(blockIDs))
	for _, b := range blockIDs {
		blocks = append(blocks, b.String())
	}
	res, err := dbcr.client.DeleteBlocks(ctx, blocks)
	if err != nil {
		return 0, 0, err
	}
	return res.NumRemoved, res.SizeRemoved, nil
}

// UpdateMetadata implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) UpdateMetadata(ctx context.Context,
	blockID kbfsblock.ID, prefetchStatus PrefetchStatus) error {
	return dbcr.client.UpdateBlockMetadata(ctx,
		kbgitkbfs.UpdateBlockMetadataArg{
			blockID.String(),
			kbgitkbfs.PrefetchStatus(prefetchStatus),
		})
}

// Status implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Status(ctx context.Context) map[string]DiskBlockCacheStatus {
	// We don't return a status because it isn't needed in the contexts
	// this block cache is used.
	return map[string]DiskBlockCacheStatus{}
}

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Shutdown(ctx context.Context) {
	dbcr.conn.Close()
}
