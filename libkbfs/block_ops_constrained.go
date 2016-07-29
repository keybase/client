// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"
	"time"

	"golang.org/x/net/context"
)

// BlockOpsConstrained implements the BlockOps interface by relaying
// requests to a delegate BlockOps, but it delays all Puts by
// simulating a bottleneck of the given bandwidth.
type BlockOpsConstrained struct {
	BlockOps
	bwKBps int
	lock   sync.Mutex
}

var _ BlockOps = (*BlockOpsConstrained)(nil)

// NewBlockOpsConstrained constructs a new BlockOpsConstrained.
func NewBlockOpsConstrained(delegate BlockOps, bwKBps int) *BlockOpsConstrained {
	return &BlockOpsConstrained{
		BlockOps: delegate,
		bwKBps:   bwKBps,
	}
}

func (b *BlockOpsConstrained) delay(ctx context.Context, size int) error {
	if b.bwKBps <= 0 {
		return nil
	}
	b.lock.Lock()
	defer b.lock.Unlock()
	// Simulate a constrained bserver connection
	delay := size * int(time.Second) / (b.bwKBps * 1024)
	time.Sleep(time.Duration(delay))
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	return nil
}

// Put implements the BlockOps interface for BlockOpsConstrained.
func (b *BlockOpsConstrained) Put(ctx context.Context, tlfID TlfID,
	blockPtr BlockPointer, readyBlockData ReadyBlockData) error {
	if err := b.delay(ctx, len(readyBlockData.buf)); err != nil {
		return err
	}
	return b.BlockOps.Put(ctx, tlfID, blockPtr, readyBlockData)
}
