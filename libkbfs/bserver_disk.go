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
	"golang.org/x/net/context"
)

// BlockServerDisk implements the BlockServer interface by just
// storing blocks in a local leveldb instance.
type BlockServerDisk struct {
	codec        Codec
	crypto       Crypto
	log          logger.Logger
	dirPath      string
	shutdownFunc func(logger.Logger)

	tlfJournalLock sync.RWMutex
	// tlfJournal is nil after Shutdown() is called.
	tlfJournal map[TlfID]*bserverTlfJournal
}

var _ BlockServer = (*BlockServerDisk)(nil)

// newBlockServerDisk constructs a new BlockServerDisk that stores
// its data in the given directory.
func newBlockServerDisk(
	config Config, dirPath string, shutdownFunc func(logger.Logger)) *BlockServerDisk {
	bserv := &BlockServerDisk{
		config.Codec(),
		config.Crypto(),
		config.MakeLogger("BSD"),
		dirPath,
		shutdownFunc,
		sync.RWMutex{},
		make(map[TlfID]*bserverTlfJournal),
	}
	return bserv
}

// NewBlockServerDir constructs a new BlockServerDisk that stores
// its data in the given directory.
func NewBlockServerDir(config Config, dirPath string) *BlockServerDisk {
	return newBlockServerDisk(config, dirPath, nil)
}

// NewBlockServerTempDir constructs a new BlockServerDisk that stores its
// data in a temp directory which is cleaned up on shutdown.
func NewBlockServerTempDir(config Config) (*BlockServerDisk, error) {
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

func (b *BlockServerDisk) getJournal(tlfID TlfID) (*bserverTlfJournal, error) {
	storage, err := func() (*bserverTlfJournal, error) {
		b.tlfJournalLock.RLock()
		defer b.tlfJournalLock.RUnlock()
		if b.tlfJournal == nil {
			return nil, errBlockServerDiskShutdown
		}
		return b.tlfJournal[tlfID], nil
	}()

	if err != nil {
		return nil, err
	}

	if storage != nil {
		return storage, nil
	}

	b.tlfJournalLock.Lock()
	defer b.tlfJournalLock.Unlock()
	if b.tlfJournal == nil {
		return nil, errBlockServerDiskShutdown
	}

	storage = b.tlfJournal[tlfID]
	if storage != nil {
		return storage, nil
	}

	path := filepath.Join(b.dirPath, tlfID.String())
	storage, err = makeBserverTlfJournal(b.codec, b.crypto, path)
	if err != nil {
		return nil, err
	}

	b.tlfJournal[tlfID] = storage
	return storage, nil
}

// Get implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) Get(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	b.log.CDebugf(ctx, "BlockServerDisk.Get id=%s tlfID=%s context=%s",
		id, tlfID, context)
	tlfJournal, err := b.getJournal(tlfID)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	data, keyServerHalf, err := tlfJournal.getData(id, context)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}
	return data, keyServerHalf, nil
}

// Put implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) Put(ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	b.log.CDebugf(ctx, "BlockServerDisk.Put id=%s tlfID=%s context=%s",
		id, tlfID, context)

	if context.GetRefNonce() != zeroBlockRefNonce {
		return fmt.Errorf("Can't Put() a block with a non-zero refnonce.")
	}

	tlfJournal, err := b.getJournal(tlfID)
	if err != nil {
		return err
	}
	return tlfJournal.putData(id, context, buf, serverHalf)
}

// AddBlockReference implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) AddBlockReference(ctx context.Context, id BlockID,
	tlfID TlfID, context BlockContext) error {
	b.log.CDebugf(ctx, "BlockServerDisk.AddBlockReference id=%s "+
		"tlfID=%s context=%s", id, tlfID, context)
	tlfJournal, err := b.getJournal(tlfID)
	if err != nil {
		return err
	}
	return tlfJournal.addReference(id, context)
}

// RemoveBlockReference implements the BlockServer interface for
// BlockServerDisk.
func (b *BlockServerDisk) RemoveBlockReference(ctx context.Context,
	tlfID TlfID, contexts map[BlockID][]BlockContext) (
	liveCounts map[BlockID]int, err error) {
	b.log.CDebugf(ctx, "BlockServerDisk.RemoveBlockReference "+
		"tlfID=%s contexts=%v", tlfID, contexts)
	tlfJournal, err := b.getJournal(tlfID)
	if err != nil {
		return nil, err
	}

	liveCounts = make(map[BlockID]int)
	for id, idContexts := range contexts {
		count, err := tlfJournal.removeReferences(id, idContexts)
		if err != nil {
			return nil, err
		}
		liveCounts[id] = count
	}
	return liveCounts, nil
}

// ArchiveBlockReferences implements the BlockServer interface for
// BlockServerDisk.
func (b *BlockServerDisk) ArchiveBlockReferences(ctx context.Context,
	tlfID TlfID, contexts map[BlockID][]BlockContext) error {
	b.log.CDebugf(ctx, "BlockServerDisk.ArchiveBlockReferences "+
		"tlfID=%s contexts=%v", tlfID, contexts)
	tlfJournal, err := b.getJournal(tlfID)
	if err != nil {
		return err
	}

	for id, idContexts := range contexts {
		err := tlfJournal.archiveReferences(id, idContexts)
		if err != nil {
			return err
		}
	}

	return nil
}

// getAll returns all the known block references, and should only be
// used during testing.
func (b *BlockServerDisk) getAll(tlfID TlfID) (
	map[BlockID]map[BlockRefNonce]blockRefLocalStatus, error) {
	tlfJournal, err := b.getJournal(tlfID)
	if err != nil {
		return nil, err
	}

	return tlfJournal.getAll()
}

// Shutdown implements the BlockServer interface for BlockServerDisk.
func (b *BlockServerDisk) Shutdown() {
	tlfJournal := func() map[TlfID]*bserverTlfJournal {
		b.tlfJournalLock.Lock()
		defer b.tlfJournalLock.Unlock()
		// Make further accesses error out.
		tlfJournal := b.tlfJournal
		b.tlfJournal = nil
		return tlfJournal
	}()

	for _, j := range tlfJournal {
		j.shutdown()
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
