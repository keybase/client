// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type blockServerDiskTlfStorage struct {
	lock sync.RWMutex
	// store is nil after it is shut down in Shutdown().
	store *blockDiskStore
}

// BlockServerDisk implements the BlockServer interface by just
// storing blocks in a local disk store.
type BlockServerDisk struct {
	codec        kbfscodec.Codec
	crypto       cryptoPure
	log          logger.Logger
	dirPath      string
	shutdownFunc func(logger.Logger)

	tlfStorageLock sync.RWMutex
	// tlfStorage is nil after Shutdown() is called.
	tlfStorage map[tlf.ID]*blockServerDiskTlfStorage
}

var _ blockServerLocal = (*BlockServerDisk)(nil)

// newBlockServerDisk constructs a new BlockServerDisk that stores
// its data in the given directory.
func newBlockServerDisk(
	config blockServerLocalConfig,
	dirPath string, shutdownFunc func(logger.Logger)) *BlockServerDisk {
	bserv := &BlockServerDisk{
		config.Codec(),
		config.cryptoPure(),
		config.MakeLogger("BSD"),
		dirPath,
		shutdownFunc,
		sync.RWMutex{},
		make(map[tlf.ID]*blockServerDiskTlfStorage),
	}
	return bserv
}

// NewBlockServerDir constructs a new BlockServerDisk that stores
// its data in the given directory.
func NewBlockServerDir(
	config blockServerLocalConfig, dirPath string) *BlockServerDisk {
	return newBlockServerDisk(config, dirPath, nil)
}

// NewBlockServerTempDir constructs a new BlockServerDisk that stores its
// data in a temp directory which is cleaned up on shutdown.
func NewBlockServerTempDir(
	config blockServerLocalConfig) (*BlockServerDisk, error) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfs_bserver_tmp")
	if err != nil {
		return nil, err
	}
	return newBlockServerDisk(config, tempdir, func(log logger.Logger) {
		err := os.RemoveAll(tempdir)
		if err != nil {
			log.Warning("error removing %s: %s", tempdir, err)
		}
	}), nil
}

var errBlockServerDiskShutdown = errors.New("BlockServerDisk is shutdown")

func (b *BlockServerDisk) getStorage(tlfID tlf.ID) (
	*blockServerDiskTlfStorage, error) {
	storage, err := func() (*blockServerDiskTlfStorage, error) {
		b.tlfStorageLock.RLock()
		defer b.tlfStorageLock.RUnlock()
		if b.tlfStorage == nil {
			return nil, errBlockServerDiskShutdown
		}
		return b.tlfStorage[tlfID], nil
	}()

	if err != nil {
		return nil, err
	}

	if storage != nil {
		return storage, nil
	}

	b.tlfStorageLock.Lock()
	defer b.tlfStorageLock.Unlock()
	if b.tlfStorage == nil {
		return nil, errBlockServerDiskShutdown
	}

	storage, ok := b.tlfStorage[tlfID]
	if ok {
		return storage, nil
	}

	path := filepath.Join(b.dirPath, tlfID.String())
	store := makeBlockDiskStore(b.codec, b.crypto, path)

	storage = &blockServerDiskTlfStorage{
		store: store,
	}

	b.tlfStorage[tlfID] = storage
	return storage, nil
}

// Get implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) Get(ctx context.Context, tlfID tlf.ID, id BlockID,
	context BlockContext) (
	data []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	defer func() {
		err = translateToBlockServerError(err)
	}()
	b.log.CDebugf(ctx, "BlockServerDisk.Get id=%s tlfID=%s context=%s",
		id, tlfID, context)
	tlfStorage, err := b.getStorage(tlfID)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	tlfStorage.lock.RLock()
	defer tlfStorage.lock.RUnlock()
	if tlfStorage.store == nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			errBlockServerDiskShutdown
	}

	data, keyServerHalf, err := tlfStorage.store.getDataWithContext(
		id, context)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	return data, keyServerHalf, nil
}

// Put implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) Put(ctx context.Context, tlfID tlf.ID, id BlockID,
	context BlockContext, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	defer func() {
		err = translateToBlockServerError(err)
	}()
	b.log.CDebugf(ctx, "BlockServerDisk.Put id=%s tlfID=%s context=%s size=%d",
		id, tlfID, context, len(buf))

	if context.GetRefNonce() != ZeroBlockRefNonce {
		return errors.New("can't Put() a block with a non-zero refnonce")
	}

	tlfStorage, err := b.getStorage(tlfID)
	if err != nil {
		return err
	}

	tlfStorage.lock.Lock()
	defer tlfStorage.lock.Unlock()
	if tlfStorage.store == nil {
		return errBlockServerDiskShutdown
	}

	err = tlfStorage.store.put(id, context, buf, serverHalf, "")
	if err != nil {
		return err
	}

	return nil
}

// AddBlockReference implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) AddBlockReference(ctx context.Context, tlfID tlf.ID,
	id BlockID, context BlockContext) error {
	b.log.CDebugf(ctx, "BlockServerDisk.AddBlockReference id=%s "+
		"tlfID=%s context=%s", id, tlfID, context)
	tlfStorage, err := b.getStorage(tlfID)
	if err != nil {
		return err
	}

	tlfStorage.lock.Lock()
	defer tlfStorage.lock.Unlock()
	if tlfStorage.store == nil {
		return errBlockServerDiskShutdown
	}

	hasRef, err := tlfStorage.store.hasAnyRef(id)
	if err != nil {
		return err
	}
	if !hasRef {
		return BServerErrorBlockNonExistent{fmt.Sprintf("Block ID %s "+
			"doesn't exist and cannot be referenced.", id)}
	}

	hasNonArchivedRef, err := tlfStorage.store.hasNonArchivedRef(id)
	if err != nil {
		return err
	}
	if !hasNonArchivedRef {
		return BServerErrorBlockArchived{fmt.Sprintf("Block ID %s has "+
			"been archived and cannot be referenced.", id)}
	}

	return tlfStorage.store.addReference(id, context, "")
}

// RemoveBlockReferences implements the BlockServer interface for
// BlockServerDisk.
func (b *BlockServerDisk) RemoveBlockReferences(ctx context.Context,
	tlfID tlf.ID, contexts map[BlockID][]BlockContext) (
	liveCounts map[BlockID]int, err error) {
	defer func() {
		err = translateToBlockServerError(err)
	}()
	b.log.CDebugf(ctx, "BlockServerDisk.RemoveBlockReference "+
		"tlfID=%s contexts=%v", tlfID, contexts)
	tlfStorage, err := b.getStorage(tlfID)
	if err != nil {
		return nil, err
	}

	tlfStorage.lock.Lock()
	defer tlfStorage.lock.Unlock()
	if tlfStorage.store == nil {
		return nil, errBlockServerDiskShutdown
	}

	liveCounts = make(map[BlockID]int)
	for id, idContexts := range contexts {
		liveCount, err := tlfStorage.store.removeReferences(
			id, idContexts, "")
		if err != nil {
			return nil, err
		}
		liveCounts[id] = liveCount

		if liveCount == 0 {
			err := tlfStorage.store.remove(id)
			if err != nil {
				return nil, err
			}
		}
	}

	return liveCounts, nil
}

// ArchiveBlockReferences implements the BlockServer interface for
// BlockServerDisk.
func (b *BlockServerDisk) ArchiveBlockReferences(ctx context.Context,
	tlfID tlf.ID, contexts map[BlockID][]BlockContext) (err error) {
	defer func() {
		err = translateToBlockServerError(err)
	}()
	b.log.CDebugf(ctx, "BlockServerDisk.ArchiveBlockReferences "+
		"tlfID=%s contexts=%v", tlfID, contexts)
	tlfStorage, err := b.getStorage(tlfID)
	if err != nil {
		return err
	}

	tlfStorage.lock.Lock()
	defer tlfStorage.lock.Unlock()
	if tlfStorage.store == nil {
		return errBlockServerDiskShutdown
	}

	for id, idContexts := range contexts {
		for _, context := range idContexts {
			hasContext, err := tlfStorage.store.hasContext(id, context)
			if err != nil {
				return err
			}
			if !hasContext {
				return BServerErrorBlockNonExistent{
					fmt.Sprintf(
						"Block ID %s (context %s) doesn't "+
							"exist and cannot be archived.",
						id, context),
				}
			}
		}
	}

	return tlfStorage.store.archiveReferences(contexts, "")
}

// getAllRefsForTest implements the blockServerLocal interface for
// BlockServerDisk.
func (b *BlockServerDisk) getAllRefsForTest(ctx context.Context, tlfID tlf.ID) (
	map[BlockID]blockRefMap, error) {
	tlfStorage, err := b.getStorage(tlfID)
	if err != nil {
		return nil, err
	}

	tlfStorage.lock.RLock()
	defer tlfStorage.lock.RUnlock()
	if tlfStorage.store == nil {
		return nil, errBlockServerDiskShutdown
	}

	return tlfStorage.store.getAllRefsForTest()
}

// IsUnflushed implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) IsUnflushed(ctx context.Context, tlfID tlf.ID,
	_ BlockID) (bool, error) {
	tlfStorage, err := b.getStorage(tlfID)
	if err != nil {
		return false, err
	}

	tlfStorage.lock.RLock()
	defer tlfStorage.lock.RUnlock()
	if tlfStorage.store == nil {
		return false, errBlockServerDiskShutdown
	}

	return false, nil
}

// Shutdown implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) Shutdown() {
	tlfStorage := func() map[tlf.ID]*blockServerDiskTlfStorage {
		b.tlfStorageLock.Lock()
		defer b.tlfStorageLock.Unlock()
		// Make further accesses error out.
		tlfStorage := b.tlfStorage
		b.tlfStorage = nil
		return tlfStorage
	}()

	for _, s := range tlfStorage {
		func() {
			s.lock.Lock()
			defer s.lock.Unlock()
			if s.store == nil {
				// Already shutdown.
				return
			}

			// Make further accesses error out.
			s.store = nil
		}()
	}

	if b.shutdownFunc != nil {
		b.shutdownFunc(b.log)
	}
}

// RefreshAuthToken implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) RefreshAuthToken(_ context.Context) {}

// GetUserQuotaInfo implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) GetUserQuotaInfo(ctx context.Context) (info *UserQuotaInfo, err error) {
	// Return a dummy value here.
	return &UserQuotaInfo{Limit: 0x7FFFFFFFFFFFFFFF}, nil
}
