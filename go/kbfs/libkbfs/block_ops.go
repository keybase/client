// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type blockOpsConfig interface {
	data.Versioner
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
	clockGetter
	reporterGetter
	settingsDBGetter
	subscriptionManagerGetter
	subscriptionManagerPublisherGetter
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
func NewBlockOpsStandard(
	config blockOpsConfig, queueSize, prefetchQueueSize int,
	throttledPrefetchPeriod time.Duration,
	appStateUpdater env.AppStateUpdater) *BlockOpsStandard {
	bg := &realBlockGetter{config: config}
	qConfig := &realBlockRetrievalConfig{
		blockRetrievalPartialConfig: config,
		bg:                          bg,
	}
	q := newBlockRetrievalQueue(
		queueSize, prefetchQueueSize, throttledPrefetchPeriod, qConfig,
		appStateUpdater)
	bops := &BlockOpsStandard{
		config: config,
		log:    traceLogger{config.MakeLogger("")},
		queue:  q,
	}
	return bops
}

// Get implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Get(ctx context.Context, kmd libkey.KeyMetadata,
	blockPtr data.BlockPointer, block data.Block,
	lifetime data.BlockCacheLifetime, branch data.BranchName) error {
	// Check the journal explicitly first, so we don't get stuck in
	// the block-fetching queue.
	if journalBServer, ok := b.config.BlockServer().(journalBlockServer); ok {
		data, serverHalf, found, err := journalBServer.getBlockFromJournal(
			ctx, kmd.TlfID(), blockPtr.ID)
		if err != nil {
			return err
		}
		if found {
			return assembleBlockLocal(
				ctx, b.config.keyGetter(), b.config.Codec(),
				b.config.cryptoPure(), kmd, blockPtr, block, data, serverHalf)
		}
	}

	b.log.LazyTrace(ctx, "BOps: Requesting %s", blockPtr.ID)

	action := b.config.Mode().DefaultBlockRequestAction()
	if branch != data.MasterBranch {
		action = action.AddNonMasterBranch()
	}
	errCh := b.queue.Request(
		ctx, defaultOnDemandRequestPriority, kmd,
		blockPtr, block, lifetime, action)
	err := <-errCh

	b.log.LazyTrace(ctx, "BOps: Request fulfilled for %s (err=%v)", blockPtr.ID, err)

	return err
}

// GetEncodedSizes implements the BlockOps interface for
// BlockOpsStandard.
func (b *BlockOpsStandard) GetEncodedSizes(
	ctx context.Context, kmd libkey.KeyMetadata,
	blockPtrs []data.BlockPointer) (
	sizes []uint32, statuses []keybase1.BlockStatus, err error) {
	// Check the journal explicitly first, so we don't get stuck in
	// the block-fetching queue.

	var ids []kbfsblock.ID
	var contexts []kbfsblock.Context
	var indices []int
	sizes = make([]uint32, len(blockPtrs))
	statuses = make([]keybase1.BlockStatus, len(blockPtrs))

	for i, blockPtr := range blockPtrs {
		if journalBServer, ok := b.config.BlockServer().(journalBlockServer); ok {
			size, found, err := journalBServer.getBlockSizeFromJournal(
				ctx, kmd.TlfID(), blockPtr.ID)
			if err != nil {
				return nil, nil, err
			}
			if found && size > 0 {
				sizes[i] = size
				statuses[i] = keybase1.BlockStatus_LIVE
				continue
			}
		}

		// Not in journal.
		ids = append(ids, blockPtr.ID)
		contexts = append(contexts, blockPtr.Context)
		indices = append(indices, i)
	}

	if len(ids) == 0 {
		return sizes, statuses, nil
	}

	servSizes, servStatuses, err := b.config.BlockServer().GetEncodedSizes(
		ctx, kmd.TlfID(), ids, contexts)
	if err != nil {
		return nil, nil, err
	}

	for i, j := range indices {
		sizes[j] = servSizes[i]
		statuses[j] = servStatuses[i]
	}
	return sizes, statuses, nil
}

// Ready implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Ready(ctx context.Context, kmd libkey.KeyMetadata,
	block data.Block) (id kbfsblock.ID, plainSize int, readyBlockData data.ReadyBlockData,
	err error) {
	defer func() {
		if err != nil {
			id = kbfsblock.ID{}
			plainSize = 0
			readyBlockData = data.ReadyBlockData{}
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

	readyBlockData = data.ReadyBlockData{
		Buf:        buf,
		ServerHalf: serverHalf,
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
	ptrs []data.BlockPointer) (liveCounts map[kbfsblock.ID]int, err error) {
	contexts := make(kbfsblock.ContextMap)
	for _, ptr := range ptrs {
		contexts[ptr.ID] = append(contexts[ptr.ID], ptr.Context)
	}
	return b.config.BlockServer().RemoveBlockReferences(ctx, tlfID, contexts)
}

// Archive implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Archive(ctx context.Context, tlfID tlf.ID,
	ptrs []data.BlockPointer) error {
	contexts := make(kbfsblock.ContextMap)
	for _, ptr := range ptrs {
		contexts[ptr.ID] = append(contexts[ptr.ID], ptr.Context)
	}

	return b.config.BlockServer().ArchiveBlockReferences(ctx, tlfID, contexts)
}

// GetLiveCount implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) GetLiveCount(
	ctx context.Context, tlfID tlf.ID, ptrs []data.BlockPointer) (
	liveCounts map[kbfsblock.ID]int, err error) {
	contexts := make(kbfsblock.ContextMap)
	for _, ptr := range ptrs {
		contexts[ptr.ID] = append(contexts[ptr.ID], ptr.Context)
	}

	return b.config.BlockServer().GetLiveBlockReferences(ctx, tlfID, contexts)
}

// TogglePrefetcher implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) TogglePrefetcher(enable bool) <-chan struct{} {
	return b.queue.TogglePrefetcher(enable, nil, nil)
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
func (b *BlockOpsStandard) Shutdown(ctx context.Context) error {
	// Block on the queue being done.
	select {
	case <-b.queue.Shutdown():
		return nil
	case <-ctx.Done():
		return errors.WithStack(ctx.Err())
	}
}
