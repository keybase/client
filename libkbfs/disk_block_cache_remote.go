package libkbfs

import (
	"context"
	"errors"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	client kbgitkbfs.DiskBlockCacheClient
	log    traceLogger
}

var _ DiskBlockCache = (*DiskBlockCacheRemote)(nil)

// NewDiskBlockCacheRemote creates a new remote disk cache client.
func NewDiskBlockCacheRemote(kbCtx Context, config diskBlockCacheRemoteConfig) (
	*DiskBlockCacheRemote, error) {
	client := kbgitkbfs.DiskBlockCacheClient{}
	return &DiskBlockCacheRemote{
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

	arg := kbgitkbfs.GetBlockArg{
		keybase1.TLFID(tlfID.String()),
		blockID.String(),
	}

	res, err := dbcr.client.GetBlock(ctx, arg)
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
