// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"net"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	kbgitkbfs "github.com/keybase/client/go/protocol/kbgitkbfs1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type diskBlockCacheRemoteConfig interface {
	logMaker
}

const (
	diskBlockCacheRemoteStatusCacheCapacity = 5000
)

// DiskBlockCacheRemote implements a client to access a remote
// DiskBlockCacheService. It implements the DiskBlockCache interface.
type DiskBlockCacheRemote struct {
	conn   net.Conn
	client kbgitkbfs.DiskBlockCacheClient
	log    traceLogger

	// Keep an LRU cache of the prefetch statuses for each block, so
	// we can avoid making an RPC to get them unless necessary.  For
	// most efficient performance, this assumes that the process using
	// this remote will basically be the only one prefetching the
	// blocks in the cache (as is the case most of the time with the
	// git helper, for example); if not, the cache might get out of
	// date, resulting in extra prefetching work to be done by this
	// process.
	statuses *lru.Cache
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

	statuses, err := lru.New(diskBlockCacheRemoteStatusCacheCapacity)
	if err != nil {
		return nil, err
	}

	return &DiskBlockCacheRemote{
		conn:     conn,
		client:   client,
		log:      traceLogger{config.MakeLogger("DBR")},
		statuses: statuses,
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
	dbcr.statuses.Add(blockID, prefetchStatus)
	return res.Buf, serverHalf, prefetchStatus, nil
}

// GetPrefetchStatus implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) GetPrefetchStatus(
	ctx context.Context, tlfID tlf.ID, blockID kbfsblock.ID,
	cacheType DiskBlockCacheType) (
	prefetchStatus PrefetchStatus, err error) {
	if tmp, ok := dbcr.statuses.Get(blockID); ok {
		prefetchStatus := tmp.(PrefetchStatus)
		return prefetchStatus, nil
	}

	dbcr.log.LazyTrace(
		ctx, "DiskBlockCacheRemote: GetPrefetchStatus %s", blockID)
	defer func() {
		dbcr.log.LazyTrace(
			ctx, "DiskBlockCacheRemote: GetPrefetchStatus %s done (err=%+v)",
			blockID, err)
	}()

	res, err := dbcr.client.GetPrefetchStatus(
		ctx, kbgitkbfs.GetPrefetchStatusArg{
			TlfID:   tlfID.Bytes(),
			BlockID: blockID.Bytes(),
		})
	if err != nil {
		return NoPrefetch, err
	}

	return PrefetchStatusFromProtocol(res), nil
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
func (dbcr *DiskBlockCacheRemote) Delete(
	ctx context.Context, blockIDs []kbfsblock.ID,
	cacheType DiskBlockCacheType) (
	numRemoved int, sizeRemoved int64, err error) {
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
	tlfID tlf.ID, blockID kbfsblock.ID, prefetchStatus PrefetchStatus,
	_ DiskBlockCacheType) error {
	dbcr.statuses.Add(blockID, prefetchStatus)
	return dbcr.client.UpdateBlockMetadata(ctx,
		kbgitkbfs.UpdateBlockMetadataArg{
			TlfID:          tlfID.Bytes(),
			BlockID:        blockID.Bytes(),
			PrefetchStatus: prefetchStatus.ToProtocol(),
		})
}

// ClearAllTlfBlocks implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) ClearAllTlfBlocks(
	_ context.Context, _ tlf.ID, _ DiskBlockCacheType) error {
	panic("ClearAllTlfBlocks() not implemented in DiskBlockCacheRemote")
}

// GetLastUnrefRev implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) GetLastUnrefRev(
	_ context.Context, _ tlf.ID, _ DiskBlockCacheType) (
	kbfsmd.Revision, error) {
	panic("GetLastUnrefRev() not implemented in DiskBlockCacheRemote")
}

// PutLastUnrefRev implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) PutLastUnrefRev(
	_ context.Context, _ tlf.ID, _ kbfsmd.Revision,
	_ DiskBlockCacheType) error {
	panic("PutLastUnrefRev() not implemented in DiskBlockCacheRemote")
}

// Status implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Status(ctx context.Context) map[string]DiskBlockCacheStatus {
	// We don't return a status because it isn't needed in the contexts
	// this block cache is used.
	panic("Status() not implemented in DiskBlockCacheRemote")
}

// DoesCacheHaveSpace implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) DoesCacheHaveSpace(
	_ context.Context, _ DiskBlockCacheType) (bool, int64, error) {
	// We won't be kicking off long syncing prefetching via the remote
	// cache, so just pretend the cache has space.
	return true, 0, nil
}

// Mark implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Mark(
	_ context.Context, _ kbfsblock.ID, _ string, _ DiskBlockCacheType) error {
	panic("Mark() not implemented in DiskBlockCacheRemote")
}

// DeleteUnmarked implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) DeleteUnmarked(
	_ context.Context, _ tlf.ID, _ string, _ DiskBlockCacheType) error {
	panic("DeleteUnmarked() not implemented in DiskBlockCacheRemote")
}

// AddHomeTLF implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) AddHomeTLF(ctx context.Context,
	tlfID tlf.ID) error {
	// Let the local cache care about home TLFs.
	return nil
}

// ClearHomeTLFs implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) ClearHomeTLFs(ctx context.Context) error {
	// Let the local cache care about home TLFs.
	return nil
}

// GetTlfSize implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) GetTlfSize(
	_ context.Context, _ tlf.ID, _ DiskBlockCacheType) (uint64, error) {
	panic("GetTlfSize() not implemented in DiskBlockCacheRemote")
}

// GetTlfIDs implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) GetTlfIDs(
	_ context.Context, _ DiskBlockCacheType) ([]tlf.ID, error) {
	panic("GetTlfIDs() not implemented in DiskBlockCacheRemote")
}

// WaitUntilStarted implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) WaitUntilStarted(
	_ DiskBlockCacheType) error {
	panic("WaitUntilStarted() not implemented in DiskBlockCacheRemote")
}

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Shutdown(ctx context.Context) {
	dbcr.conn.Close()
}
