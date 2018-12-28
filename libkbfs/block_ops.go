// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type blockOpsConfig interface {
	dataVersioner
	logMaker
	blockCacher
	blockServerGetter
	codecGetter
	cryptoPureGetter
	keyGetterGetter
	diskBlockCacheGetter
	syncedTlfGetterSetter
	initModeGetter
	blockCryptVersioner
}

// BlockOpsStandard implements the BlockOps interface by relaying
// requests to the block server.
type BlockOpsStandard struct {
	config blockOpsConfig
	log    traceLogger
	queue  *blockRetrievalQueue
}

var _ BlockOps = (*BlockOpsStandard)(nil)

// NewBlockOpsStandard creates a new BlockOpsStandard
func NewBlockOpsStandard(config blockOpsConfig,
	queueSize, prefetchQueueSize int) *BlockOpsStandard {
	bg := &realBlockGetter{config: config}
	qConfig := &realBlockRetrievalConfig{
		blockRetrievalPartialConfig: config,
		bg: bg,
	}
	q := newBlockRetrievalQueue(queueSize, prefetchQueueSize, qConfig)
	bops := &BlockOpsStandard{
		config: config,
		log:    traceLogger{config.MakeLogger("")},
		queue:  q,
	}
	return bops
}

// Get implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Get(ctx context.Context, kmd KeyMetadata,
	blockPtr BlockPointer, block Block, lifetime BlockCacheLifetime) error {
	// Check the journal explicitly first, so we don't get stuck in
	// the block-fetching queue.
	if journalBServer, ok := b.config.BlockServer().(journalBlockServer); ok {
		data, serverHalf, found, err := journalBServer.getBlockFromJournal(
			kmd.TlfID(), blockPtr.ID)
		if err != nil {
			return err
		}
		if found {
			return assembleBlock(
				ctx, b.config.keyGetter(), b.config.Codec(),
				b.config.cryptoPure(), kmd, blockPtr, block, data, serverHalf)
		}
	}

	b.log.LazyTrace(ctx, "BOps: Requesting %s", blockPtr.ID)

	errCh := b.queue.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		blockPtr, block, lifetime, b.config.Mode().DefaultBlockRequestAction())
	err := <-errCh

	b.log.LazyTrace(ctx, "BOps: Request fulfilled for %s (err=%v)", blockPtr.ID, err)

	return err
}

// GetEncodedSize implements the BlockOps interface for
// BlockOpsStandard.
func (b *BlockOpsStandard) GetEncodedSize(ctx context.Context, kmd KeyMetadata,
	blockPtr BlockPointer) (uint32, keybase1.BlockStatus, error) {
	// Check the journal explicitly first, so we don't get stuck in
	// the block-fetching queue.
	if journalBServer, ok := b.config.BlockServer().(journalBlockServer); ok {
		size, found, err := journalBServer.getBlockSizeFromJournal(
			kmd.TlfID(), blockPtr.ID)
		if err != nil {
			return 0, 0, err
		}
		if found && size > 0 {
			return size, keybase1.BlockStatus_LIVE, nil
		}
	}

	return b.config.BlockServer().GetEncodedSize(
		ctx, kmd.TlfID(), blockPtr.ID, blockPtr.Context)
}

// Ready implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Ready(ctx context.Context, kmd KeyMetadata,
	block Block) (id kbfsblock.ID, plainSize int, readyBlockData ReadyBlockData,
	err error) {
	defer func() {
		if err != nil {
			id = kbfsblock.ID{}
			plainSize = 0
			readyBlockData = ReadyBlockData{}
		}
	}()

	crypto := b.config.cryptoPure()

	tlfCryptKey, err := b.config.keyGetter().
		GetTLFCryptKeyForEncryption(ctx, kmd)
	if err != nil {
		return
	}

	// New server key half for the block.
	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		return
	}

	plainSize, encryptedBlock, err := crypto.EncryptBlock(
		block, tlfCryptKey, serverHalf)
	if err != nil {
		return
	}

	buf, err := b.config.Codec().Encode(encryptedBlock)
	if err != nil {
		return
	}

	readyBlockData = ReadyBlockData{
		buf:        buf,
		serverHalf: serverHalf,
	}

	encodedSize := readyBlockData.GetEncodedSize()
	if encodedSize < plainSize {
		err = TooLowByteCountError{
			ExpectedMinByteCount: plainSize,
			ByteCount:            encodedSize,
		}
		return
	}

	id, err = kbfsblock.MakePermanentID(buf, encryptedBlock.Version)
	if err != nil {
		return
	}

	// Cache the encoded size.
	block.SetEncodedSize(uint32(encodedSize))

	return
}

// Delete implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Delete(ctx context.Context, tlfID tlf.ID,
	ptrs []BlockPointer) (liveCounts map[kbfsblock.ID]int, err error) {
	contexts := make(kbfsblock.ContextMap)
	for _, ptr := range ptrs {
		contexts[ptr.ID] = append(contexts[ptr.ID], ptr.Context)
	}
	return b.config.BlockServer().RemoveBlockReferences(ctx, tlfID, contexts)
}

// Archive implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Archive(ctx context.Context, tlfID tlf.ID,
	ptrs []BlockPointer) error {
	contexts := make(kbfsblock.ContextMap)
	for _, ptr := range ptrs {
		contexts[ptr.ID] = append(contexts[ptr.ID], ptr.Context)
	}

	return b.config.BlockServer().ArchiveBlockReferences(ctx, tlfID, contexts)
}

// TogglePrefetcher implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) TogglePrefetcher(enable bool) <-chan struct{} {
	return b.queue.TogglePrefetcher(enable, nil)
}

// Prefetcher implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Prefetcher() Prefetcher {
	return b.queue.Prefetcher()
}

// BlockRetriever implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) BlockRetriever() BlockRetriever {
	return b.queue
}

// Shutdown implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Shutdown() {
	b.queue.Shutdown()
}
