package libkbfs

import (
	"context"
	"errors"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
)

type DiskBlockCacheRemote struct {
}

var _ DiskBlockCache = (*DiskBlockCacheRemote)(nil)

// Get implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Get(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID) (buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	prefetchStatus PrefetchStatus, err error) {
	err = errors.New("not implemented")
	return
}

// Put implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Put(ctx context.Context, tlfID tlf.ID,
	blockID kbfsblock.ID, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	return errors.New("not implemented")
}

// Delete implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Delete(ctx context.Context,
	blockIDs []kbfsblock.ID) (numRemoved int, sizeRemoved int64, err error) {
	err = errors.New("not implemented")
	return
}

// UpdateMetadata implements the DiskBlockCache interface for
// DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) UpdateMetadata(ctx context.Context,
	blockID kbfsblock.ID, prefetchStatus PrefetchStatus) error {
	return errors.New("not implemented")
}

// Status implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Status(ctx context.Context) map[string]DiskBlockCacheStatus {
	return map[string]DiskBlockCacheStatus{}
}

// Shutdown implements the DiskBlockCache interface for DiskBlockCacheRemote.
func (dbcr *DiskBlockCacheRemote) Shutdown(ctx context.Context) {
}
