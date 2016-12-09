// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// BlockOpsStandard implements the BlockOps interface by relaying
// requests to the block server.
type BlockOpsStandard struct {
	config  Config
	queue   *blockRetrievalQueue
	workers []*blockRetrievalWorker
}

var _ BlockOps = (*BlockOpsStandard)(nil)

// NewBlockOpsStandard creates a new BlockOpsStandard
func NewBlockOpsStandard(config Config, queueSize int) *BlockOpsStandard {
	bops := &BlockOpsStandard{
		config:  config,
		queue:   newBlockRetrievalQueue(queueSize, config.Codec()),
		workers: make([]*blockRetrievalWorker, 0, queueSize),
	}
	bg := &realBlockGetter{config: config}
	for i := 0; i < queueSize; i++ {
		bops.workers = append(bops.workers, newBlockRetrievalWorker(bg, bops.queue))
	}
	return bops
}

// Get implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Get(ctx context.Context, kmd KeyMetadata,
	blockPtr BlockPointer, block Block, lifetime BlockCacheLifetime) error {
	errCh := b.queue.Request(ctx, defaultOnDemandRequestPriority, kmd, blockPtr, block)
	return <-errCh
}

// Ready implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Ready(ctx context.Context, kmd KeyMetadata,
	block Block) (id BlockID, plainSize int, readyBlockData ReadyBlockData,
	err error) {
	defer func() {
		if err != nil {
			id = BlockID{}
			plainSize = 0
			readyBlockData = ReadyBlockData{}
		}
	}()

	crypto := b.config.Crypto()

	tlfCryptKey, err := b.config.KeyManager().
		GetTLFCryptKeyForEncryption(ctx, kmd)
	if err != nil {
		return
	}

	// New server key half for the block.
	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	if err != nil {
		return
	}

	blockKey, err := crypto.UnmaskBlockCryptKey(serverHalf, tlfCryptKey)
	if err != nil {
		return
	}

	plainSize, encryptedBlock, err := crypto.EncryptBlock(block, blockKey)
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

	id, err = crypto.MakePermanentBlockID(buf)
	if err != nil {
		return
	}

	// Cache the encoded size.
	block.SetEncodedSize(uint32(encodedSize))

	return
}

// Delete implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Delete(ctx context.Context, tlfID tlf.ID,
	ptrs []BlockPointer) (liveCounts map[BlockID]int, err error) {
	contexts := make(map[BlockID][]BlockContext)
	for _, ptr := range ptrs {
		contexts[ptr.ID] = append(contexts[ptr.ID], ptr.BlockContext)
	}
	return b.config.BlockServer().RemoveBlockReferences(ctx, tlfID, contexts)
}

// Archive implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Archive(ctx context.Context, tlfID tlf.ID,
	ptrs []BlockPointer) error {
	contexts := make(map[BlockID][]BlockContext)
	for _, ptr := range ptrs {
		contexts[ptr.ID] = append(contexts[ptr.ID], ptr.BlockContext)
	}

	return b.config.BlockServer().ArchiveBlockReferences(ctx, tlfID, contexts)
}

// Shutdown implements the BlockOps interface for BlockOpsStandard.
func (b *BlockOpsStandard) Shutdown() {
	b.queue.Shutdown()
	for _, w := range b.workers {
		w.Shutdown()
	}
}
