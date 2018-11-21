// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"net"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	kbgitkbfs "github.com/keybase/kbfs/protocol/kbgitkbfs1"
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
	blockID kbfsblock.ID, _ DiskBlockCacheType) (buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	prefetchStatus PrefetchStatus, err error) {
	dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Get %s", blockID)
	defer func() {
		dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Get %s done (err=%+v)", blockID, err)
	}()

	res, err := dbcr.client.GetBlock(ctx, kbgitkbfs.GetBlockArg{
		TlfID:   tlfID.Bytes(),
		BlockID: blockID.Bytes(),
	})
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
	}

	err = serverHalf.UnmarshalBinary(res.ServerHalf)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, NoPrefetch, err
	}
	prefetchStatus = PrefetchStatusFromProtocol(res.PrefetchStatus)

	return res.Buf, serverHalf, prefetchStatus, nil
}

// Put implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	_ DiskBlockCacheType) (err error) {
	dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Put %s", blockID)
	defer func() {
		dbcr.log.LazyTrace(ctx, "DiskBlockCacheRemote: Put %s done (err=%+v)", blockID, err)
	}()

	return dbcr.client.PutBlock(ctx, kbgitkbfs.PutBlockArg{
		TlfID:      tlfID.Bytes(),
		BlockID:    blockID.Bytes(),
		Buf:        buf,
		ServerHalf: serverHalf.Bytes(),
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
	blocks := make([][]byte, 0, len(blockIDs))
	for _, b := range blockIDs {
		blocks = append(blocks, b.Bytes())
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
			BlockID:        blockID.Bytes(),
			PrefetchStatus: prefetchStatus.ToProtocol(),
		})
}

// ClearAllTlfBlocks implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) ClearAllTlfBlocks(
	_ context.Context, _ tlf.ID) error {
	panic("ClearAllTlfBlocks() not implemented in DiskBlockCacheRemote")
}

// GetLastUnrefRev implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) GetLastUnrefRev(
	_ context.Context, _ tlf.ID) (kbfsmd.Revision, error) {
	panic("GetLastUnrefRev() not implemented in DiskBlockCacheRemote")
}

// PutLastUnrefRev implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) PutLastUnrefRev(
	_ context.Context, _ tlf.ID, _ kbfsmd.Revision) error {
	panic("PutLastUnrefRev() not implemented in DiskBlockCacheRemote")
}

// Status implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Status(ctx context.Context) map[string]DiskBlockCacheStatus {
	// We don't return a status because it isn't needed in the contexts
	// this block cache is used.
	panic("Status() not implemented in DiskBlockCacheRemote")
}

// DoesSyncCacheHaveSpace implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) DoesSyncCacheHaveSpace(
	_ context.Context) bool {
	panic("DoesSyncCacheHaveSpace() not implemented in DiskBlockCacheRemote")
}

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Shutdown(ctx context.Context) {
	dbcr.conn.Close()
}
