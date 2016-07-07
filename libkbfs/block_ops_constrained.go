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

// NewBlockOpsConstrained constructs a new BlockOpsConstrained.
func NewBlockOpsConstrained(delegate BlockOps, bwKBps int) *BlockOpsConstrained {
	return &BlockOpsConstrained{
		BlockOps: delegate,
		bwKBps:   bwKBps,
	}
}

// Put implements the BlockOps interface for BlockOpsConstrained.
func (b *BlockOpsConstrained) Put(ctx context.Context, md *RootMetadata,
	blockPtr BlockPointer, readyBlockData ReadyBlockData) error {
	if b.bwKBps > 0 {
		b.lock.Lock()
		// Simulate a constrained bserver connection
		delay := len(readyBlockData.buf) * int(time.Second) / (b.bwKBps * 1024)
		time.Sleep(time.Duration(delay))
		b.lock.Unlock()
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
	}
	return b.BlockOps.Put(ctx, md, blockPtr, readyBlockData)
}
