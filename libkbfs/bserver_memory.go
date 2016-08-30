// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// TODO: Move this to bserver_errors.go once the actual block server
// starts using it.
type bserverErrorContextMismatch struct {
	expected, actual BlockContext
}

func (e bserverErrorContextMismatch) Error() string {
	return fmt.Sprintf(
		"Context mismatch: expected %s, got %s", e.expected, e.actual)
}

type blockRefEntry struct {
	// These fields are exported only for serialization purposes.
	Status  blockRefLocalStatus
	Context BlockContext

	// TODO: Add unknown field support.
}

func (e blockRefEntry) checkContext(context BlockContext) error {
	if e.Context != context {
		return bserverErrorContextMismatch{e.Context, context}
	}
	return nil
}

// blockRefMap is a map with additional checking methods.
type blockRefMap map[BlockRefNonce]blockRefEntry

func (refs blockRefMap) hasNonArchivedRef() bool {
	for _, refEntry := range refs {
		if refEntry.Status == liveBlockRef {
			return true
		}
	}
	return false
}

func (refs blockRefMap) checkExists(context BlockContext) error {
	refEntry, ok := refs[context.GetRefNonce()]
	if !ok {
		return BServerErrorBlockNonExistent{}
	}

	return refEntry.checkContext(context)
}

func (refs blockRefMap) getStatuses() map[BlockRefNonce]blockRefLocalStatus {
	statuses := make(map[BlockRefNonce]blockRefLocalStatus)
	for ref, refEntry := range refs {
		statuses[ref] = refEntry.Status
	}
	return statuses
}

func (refs blockRefMap) put(
	context BlockContext, status blockRefLocalStatus) error {
	refNonce := context.GetRefNonce()
	if refEntry, ok := refs[refNonce]; ok {
		err := refEntry.checkContext(context)
		if err != nil {
			return err
		}
	}

	refs[refNonce] = blockRefEntry{
		Status:  status,
		Context: context,
	}
	return nil
}

func (refs blockRefMap) remove(context BlockContext) error {
	refNonce := context.GetRefNonce()
	// If this check fails, this ref is already gone, which is not
	// an error.
	if refEntry, ok := refs[refNonce]; ok {
		err := refEntry.checkContext(context)
		if err != nil {
			return err
		}
		delete(refs, refNonce)
	}
	return nil
}

type blockMemEntry struct {
	tlfID         TlfID
	blockData     []byte
	keyServerHalf BlockCryptKeyServerHalf
	refs          blockRefMap
}

// BlockServerMemory implements the BlockServer interface by just
// storing blocks in memory.
type BlockServerMemory struct {
	crypto cryptoPure
	log    logger.Logger

	lock sync.RWMutex
	// m is nil after Shutdown() is called.
	m map[BlockID]blockMemEntry
}

var _ blockServerLocal = (*BlockServerMemory)(nil)

// NewBlockServerMemory constructs a new BlockServerMemory that stores
// its data in memory.
func NewBlockServerMemory(config blockServerLocalConfig) *BlockServerMemory {
	return &BlockServerMemory{
		config.cryptoPure(),
		config.MakeLogger("BSM"),
		sync.RWMutex{},
		make(map[BlockID]blockMemEntry),
	}
}

var errBlockServerMemoryShutdown = errors.New("BlockServerMemory is shutdown")

// Get implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) Get(ctx context.Context, tlfID TlfID, id BlockID,
	context BlockContext) ([]byte, BlockCryptKeyServerHalf, error) {
	b.log.CDebugf(ctx, "BlockServerMemory.Get id=%s tlfID=%s context=%s",
		id, tlfID, context)
	b.lock.RLock()
	defer b.lock.RUnlock()

	if b.m == nil {
		return nil, BlockCryptKeyServerHalf{}, errBlockServerMemoryShutdown
	}

	entry, ok := b.m[id]
	if !ok {
		return nil, BlockCryptKeyServerHalf{}, BServerErrorBlockNonExistent{}
	}

	if entry.tlfID != tlfID {
		return nil, BlockCryptKeyServerHalf{},
			fmt.Errorf("TLF ID mismatch: expected %s, got %s",
				entry.tlfID, tlfID)
	}

	err := entry.refs.checkExists(context)
	if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	return entry.blockData, entry.keyServerHalf, nil
}

func validateBlockServerPut(
	crypto cryptoPure, id BlockID, context BlockContext, buf []byte) error {
	if context.GetCreator() != context.GetWriter() {
		return fmt.Errorf("Can't Put() a block with creator=%s != writer=%s",
			context.GetCreator(), context.GetWriter())
	}

	if context.GetRefNonce() != zeroBlockRefNonce {
		return fmt.Errorf("Can't Put() a block with a non-zero refnonce.")
	}

	bufID, err := crypto.MakePermanentBlockID(buf)
	if err != nil {
		return err
	}

	if id != bufID {
		return fmt.Errorf(
			"Block ID mismatch: expected %s, got %s", id, bufID)
	}

	return nil
}

// Put implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) Put(ctx context.Context, tlfID TlfID, id BlockID,
	context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	b.log.CDebugf(ctx, "BlockServerMemory.Put id=%s tlfID=%s context=%s "+
		"size=%d", id, tlfID, context, len(buf))

	err := validateBlockServerPut(b.crypto, id, context, buf)
	if err != nil {
		return err
	}

	b.lock.Lock()
	defer b.lock.Unlock()

	if b.m == nil {
		return errBlockServerMemoryShutdown
	}

	var refs blockRefMap
	if entry, ok := b.m[id]; ok {
		// If the entry already exists, everything should be
		// the same, except for possibly additional
		// references.

		if entry.tlfID != tlfID {
			return fmt.Errorf(
				"TLF ID mismatch: expected %s, got %s",
				entry.tlfID, tlfID)
		}

		// We checked that buf hashes to id, so no need to
		// check that it's equal to entry.data (since that was
		// presumably already checked previously).

		if entry.keyServerHalf != serverHalf {
			return fmt.Errorf(
				"key server half mismatch: expected %s, got %s",
				entry.keyServerHalf, serverHalf)
		}

		refs = entry.refs
	} else {
		data := make([]byte, len(buf))
		copy(data, buf)
		refs = make(blockRefMap)
		b.m[id] = blockMemEntry{
			tlfID:         tlfID,
			blockData:     data,
			keyServerHalf: serverHalf,
			refs:          refs,
		}
	}

	return refs.put(context, liveBlockRef)
}

// AddBlockReference implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) AddBlockReference(ctx context.Context, tlfID TlfID,
	id BlockID, context BlockContext) error {
	b.log.CDebugf(ctx, "BlockServerMemory.AddBlockReference id=%s "+
		"tlfID=%s context=%s", id, tlfID, context)

	b.lock.Lock()
	defer b.lock.Unlock()

	if b.m == nil {
		return errBlockServerMemoryShutdown
	}

	entry, ok := b.m[id]
	if !ok {
		return BServerErrorBlockNonExistent{fmt.Sprintf("Block ID %s doesn't "+
			"exist and cannot be referenced.", id)}
	}

	if entry.tlfID != tlfID {
		return fmt.Errorf("TLF ID mismatch: expected %s, got %s",
			entry.tlfID, tlfID)
	}

	// Only add it if there's a non-archived reference.
	if !entry.refs.hasNonArchivedRef() {
		return BServerErrorBlockArchived{fmt.Sprintf("Block ID %s has "+
			"been archived and cannot be referenced.", id)}
	}

	return entry.refs.put(context, liveBlockRef)
}

func (b *BlockServerMemory) removeBlockReference(
	tlfID TlfID, id BlockID, contexts []BlockContext) (int, error) {
	b.lock.Lock()
	defer b.lock.Unlock()

	if b.m == nil {
		return 0, errBlockServerMemoryShutdown
	}

	entry, ok := b.m[id]
	if !ok {
		// This block is already gone; no error.
		return 0, nil
	}

	if entry.tlfID != tlfID {
		return 0, fmt.Errorf("TLF ID mismatch: expected %s, got %s",
			entry.tlfID, tlfID)
	}

	for _, context := range contexts {
		err := entry.refs.remove(context)
		if err != nil {
			return 0, err
		}
	}
	count := len(entry.refs)
	if count == 0 {
		delete(b.m, id)
	}
	return count, nil
}

// RemoveBlockReferences implements the BlockServer interface for
// BlockServerMemory.
func (b *BlockServerMemory) RemoveBlockReferences(ctx context.Context,
	tlfID TlfID, contexts map[BlockID][]BlockContext) (
	liveCounts map[BlockID]int, err error) {
	b.log.CDebugf(ctx, "BlockServerMemory.RemoveBlockReference "+
		"tlfID=%s contexts=%v", tlfID, contexts)
	liveCounts = make(map[BlockID]int)
	for id, idContexts := range contexts {
		count, err := b.removeBlockReference(tlfID, id, idContexts)
		if err != nil {
			return nil, err
		}
		liveCounts[id] = count
	}
	return liveCounts, nil
}

func (b *BlockServerMemory) archiveBlockReference(
	tlfID TlfID, id BlockID, context BlockContext) error {
	b.lock.Lock()
	defer b.lock.Unlock()

	if b.m == nil {
		return errBlockServerMemoryShutdown
	}

	entry, ok := b.m[id]
	if !ok {
		return BServerErrorBlockNonExistent{fmt.Sprintf("Block ID %s doesn't "+
			"exist and cannot be archived.", id)}
	}

	if entry.tlfID != tlfID {
		return fmt.Errorf("TLF ID mismatch: expected %s, got %s",
			entry.tlfID, tlfID)
	}

	err := entry.refs.checkExists(context)
	if _, ok := err.(BServerErrorBlockNonExistent); ok {
		return BServerErrorBlockNonExistent{fmt.Sprintf("Block ID %s (ref %s) "+
			"doesn't exist and cannot be archived.", id, context.GetRefNonce())}
	} else if err != nil {
		return err
	}

	return entry.refs.put(context, archivedBlockRef)
}

// ArchiveBlockReferences implements the BlockServer interface for
// BlockServerMemory.
func (b *BlockServerMemory) ArchiveBlockReferences(ctx context.Context,
	tlfID TlfID, contexts map[BlockID][]BlockContext) error {
	b.log.CDebugf(ctx, "BlockServerMemory.ArchiveBlockReferences "+
		"tlfID=%s contexts=%v", tlfID, contexts)

	for id, idContexts := range contexts {
		for _, context := range idContexts {
			err := b.archiveBlockReference(tlfID, id, context)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// getAll returns all the known block references, and should only be
// used during testing.
func (b *BlockServerMemory) getAll(ctx context.Context, tlfID TlfID) (
	map[BlockID]map[BlockRefNonce]blockRefLocalStatus, error) {
	res := make(map[BlockID]map[BlockRefNonce]blockRefLocalStatus)
	b.lock.RLock()
	defer b.lock.RUnlock()

	if b.m == nil {
		return nil, errBlockServerMemoryShutdown
	}

	for id, entry := range b.m {
		if entry.tlfID != tlfID {
			continue
		}
		res[id] = entry.refs.getStatuses()
	}
	return res, nil
}

func (b *BlockServerMemory) numBlocks() int {
	b.lock.RLock()
	defer b.lock.RUnlock()
	return len(b.m)
}

// Shutdown implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) Shutdown() {
	b.lock.Lock()
	defer b.lock.Unlock()
	// Make further accesses error out.
	b.m = nil
}

// RefreshAuthToken implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) RefreshAuthToken(_ context.Context) {}

// GetUserQuotaInfo implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) GetUserQuotaInfo(ctx context.Context) (info *UserQuotaInfo, err error) {
	// Return a dummy value here.
	return &UserQuotaInfo{Limit: 0x7FFFFFFFFFFFFFFF}, nil
}
