// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"math"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type blockMemEntry struct {
	tlfID         tlf.ID
	blockData     []byte
	keyServerHalf kbfscrypto.BlockCryptKeyServerHalf
	refs          blockRefMap
}

// BlockServerMemory implements the BlockServer interface by just
// storing blocks in memory.
type BlockServerMemory struct {
	log logger.Logger

	lock sync.RWMutex
	// m is nil after Shutdown() is called.
	m map[kbfsblock.ID]blockMemEntry
}

var _ blockServerLocal = (*BlockServerMemory)(nil)

// NewBlockServerMemory constructs a new BlockServerMemory that stores
// its data in memory.
func NewBlockServerMemory(log logger.Logger) *BlockServerMemory {
	return &BlockServerMemory{
		log, sync.RWMutex{}, make(map[kbfsblock.ID]blockMemEntry),
	}
}

var errBlockServerMemoryShutdown = errors.New("BlockServerMemory is shutdown")

// Get implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) Get(ctx context.Context, tlfID tlf.ID,
	id kbfsblock.ID, context kbfsblock.Context) (
	data []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	if err := checkContext(ctx); err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	defer func() {
		err = translateToBlockServerError(err)
	}()
	b.log.CDebugf(ctx, "BlockServerMemory.Get id=%s tlfID=%s context=%s",
		id, tlfID, context)
	b.lock.RLock()
	defer b.lock.RUnlock()

	if b.m == nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			errBlockServerMemoryShutdown
	}

	entry, ok := b.m[id]
	if !ok {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			kbfsblock.BServerErrorBlockNonExistent{
				Msg: fmt.Sprintf("Block ID %s does not exist.", id)}
	}

	if entry.tlfID != tlfID {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			fmt.Errorf("TLF ID mismatch: expected %s, got %s",
				entry.tlfID, tlfID)
	}

	exists, err := entry.refs.checkExists(context)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	if !exists {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{},
			blockNonExistentError{id}
	}

	return entry.blockData, entry.keyServerHalf, nil
}

func validateBlockPut(
	id kbfsblock.ID, context kbfsblock.Context, buf []byte) error {
	var emptyID keybase1.UserOrTeamID
	if context.GetCreator() == emptyID {
		return fmt.Errorf("Can't Put() a block %v with an empty UID", id)
	}

	if context.GetCreator() != keybase1.UserOrTeamID(context.GetWriter()) {
		return fmt.Errorf("Can't Put() a block with creator=%s != writer=%s",
			context.GetCreator(), context.GetWriter())
	}

	if context.GetRefNonce() != kbfsblock.ZeroRefNonce {
		return errors.New("can't Put() a block with a non-zero refnonce")
	}

	return kbfsblock.VerifyID(buf, id)
}

// Put implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) Put(ctx context.Context, tlfID tlf.ID,
	id kbfsblock.ID, context kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	if err := checkContext(ctx); err != nil {
		return err
	}

	defer func() {
		err = translateToBlockServerError(err)
	}()
	b.log.CDebugf(ctx, "BlockServerMemory.Put id=%s tlfID=%s context=%s "+
		"size=%d", id, tlfID, context, len(buf))

	err = validateBlockPut(id, context, buf)
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

	return refs.put(context, liveBlockRef, "")
}

// AddBlockReference implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) AddBlockReference(ctx context.Context, tlfID tlf.ID,
	id kbfsblock.ID, context kbfsblock.Context) (err error) {
	if err := checkContext(ctx); err != nil {
		return err
	}

	defer func() {
		err = translateToBlockServerError(err)
	}()
	b.log.CDebugf(ctx, "BlockServerMemory.AddBlockReference id=%s "+
		"tlfID=%s context=%s", id, tlfID, context)

	b.lock.Lock()
	defer b.lock.Unlock()

	if b.m == nil {
		return errBlockServerMemoryShutdown
	}

	entry, ok := b.m[id]
	if !ok {
		return kbfsblock.BServerErrorBlockNonExistent{
			Msg: fmt.Sprintf("Block ID %s doesn't "+
				"exist and cannot be referenced.", id)}
	}

	if entry.tlfID != tlfID {
		return fmt.Errorf("TLF ID mismatch: expected %s, got %s",
			entry.tlfID, tlfID)
	}

	// Only add it if there's a non-archived reference.
	if !entry.refs.hasNonArchivedRef() {
		return kbfsblock.BServerErrorBlockArchived{
			Msg: fmt.Sprintf("Block ID %s has "+
				"been archived and cannot be referenced.", id)}
	}

	return entry.refs.put(context, liveBlockRef, "")
}

func (b *BlockServerMemory) removeBlockReference(
	tlfID tlf.ID, id kbfsblock.ID, contexts []kbfsblock.Context) (
	int, error) {
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
		err := entry.refs.remove(context, "")
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
	tlfID tlf.ID, contexts kbfsblock.ContextMap) (
	liveCounts map[kbfsblock.ID]int, err error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	defer func() {
		err = translateToBlockServerError(err)
	}()
	b.log.CDebugf(ctx, "BlockServerMemory.RemoveBlockReference "+
		"tlfID=%s contexts=%v", tlfID, contexts)
	liveCounts = make(map[kbfsblock.ID]int)
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
	tlfID tlf.ID, id kbfsblock.ID, context kbfsblock.Context) error {
	b.lock.Lock()
	defer b.lock.Unlock()

	if b.m == nil {
		return errBlockServerMemoryShutdown
	}

	entry, ok := b.m[id]
	if !ok {
		return kbfsblock.BServerErrorBlockNonExistent{
			Msg: fmt.Sprintf("Block ID %s doesn't "+
				"exist and cannot be archived.", id)}
	}

	if entry.tlfID != tlfID {
		return fmt.Errorf("TLF ID mismatch: expected %s, got %s",
			entry.tlfID, tlfID)
	}

	exists, err := entry.refs.checkExists(context)
	if err != nil {
		return err
	}
	if !exists {
		return kbfsblock.BServerErrorBlockNonExistent{
			Msg: fmt.Sprintf("Block ID %s (ref %s) "+
				"doesn't exist and cannot be archived.",
				id, context.GetRefNonce())}
	}

	return entry.refs.put(context, archivedBlockRef, "")
}

// ArchiveBlockReferences implements the BlockServer interface for
// BlockServerMemory.
func (b *BlockServerMemory) ArchiveBlockReferences(ctx context.Context,
	tlfID tlf.ID, contexts kbfsblock.ContextMap) (err error) {
	if err := checkContext(ctx); err != nil {
		return err
	}

	defer func() {
		err = translateToBlockServerError(err)
	}()
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

// getAllRefsForTest implements the blockServerLocal interface for
// BlockServerMemory.
func (b *BlockServerMemory) getAllRefsForTest(
	ctx context.Context, tlfID tlf.ID) (
	map[kbfsblock.ID]blockRefMap, error) {
	res := make(map[kbfsblock.ID]blockRefMap)
	b.lock.RLock()
	defer b.lock.RUnlock()

	if b.m == nil {
		return nil, errBlockServerMemoryShutdown
	}

	for id, entry := range b.m {
		if entry.tlfID != tlfID {
			continue
		}
		res[id] = entry.refs.deepCopy()
	}
	return res, nil
}

func (b *BlockServerMemory) numBlocks() int {
	b.lock.RLock()
	defer b.lock.RUnlock()
	return len(b.m)
}

// IsUnflushed implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) IsUnflushed(ctx context.Context, tlfID tlf.ID,
	_ kbfsblock.ID) (bool, error) {
	b.lock.RLock()
	defer b.lock.RUnlock()

	if b.m == nil {
		return false, errBlockServerMemoryShutdown
	}

	return false, nil
}

// Shutdown implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) Shutdown(ctx context.Context) {
	b.lock.Lock()
	defer b.lock.Unlock()
	// Make further accesses error out.
	b.m = nil
}

// RefreshAuthToken implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) RefreshAuthToken(_ context.Context) {}

// GetUserQuotaInfo implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) GetUserQuotaInfo(ctx context.Context) (info *kbfsblock.QuotaInfo, err error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	// Return a dummy value here.
	return &kbfsblock.QuotaInfo{Limit: math.MaxInt64}, nil
}

// GetTeamQuotaInfo implements the BlockServer interface for BlockServerMemory.
func (b *BlockServerMemory) GetTeamQuotaInfo(
	ctx context.Context, _ keybase1.TeamID) (
	info *kbfsblock.QuotaInfo, err error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	// TODO: check team membership and return error if not a reader?

	// Return a dummy value here.
	return &kbfsblock.QuotaInfo{Limit: math.MaxInt64}, nil
}
