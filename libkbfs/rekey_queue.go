// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/kbfs/kbfssync"
	"github.com/keybase/kbfs/tlf"

	"golang.org/x/net/context"
)

type rekeyQueueEntry struct {
	id tlf.ID
	ch chan error
}

// RekeyQueueStandard implements the RekeyQueue interface.
type RekeyQueueStandard struct {
	config    Config
	queueMu   sync.RWMutex // protects all of the below
	queue     []rekeyQueueEntry
	hasWorkCh chan struct{}
	cancel    context.CancelFunc
	wg        kbfssync.RepeatedWaitGroup
}

// Test that RekeyQueueStandard fully implements the RekeyQueue interface.
var _ RekeyQueue = (*RekeyQueueStandard)(nil)

// NewRekeyQueueStandard instantiates a new rekey worker.
func NewRekeyQueueStandard(config Config) *RekeyQueueStandard {
	rkq := &RekeyQueueStandard{
		config: config,
	}
	return rkq
}

// Enqueue implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Enqueue(id tlf.ID) <-chan error {
	c := make(chan error, 1)
	err := func() error {
		rkq.queueMu.Lock()
		defer rkq.queueMu.Unlock()
		if rkq.cancel == nil {
			// create a new channel
			rkq.hasWorkCh = make(chan struct{}, 1)
			// spawn goroutine if needed
			var ctx context.Context
			ctx, rkq.cancel = context.WithCancel(context.Background())
			go rkq.processRekeys(ctx, rkq.hasWorkCh)
		}
		rkq.queue = append(rkq.queue, rekeyQueueEntry{id, c})
		return nil
	}()
	if err != nil {
		c <- err
		close(c)
		return c
	}
	rkq.wg.Add(1)
	// poke the channel
	select {
	case rkq.hasWorkCh <- struct{}{}:
	default:
	}
	return c
}

// IsRekeyPending implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) IsRekeyPending(id tlf.ID) bool {
	return rkq.GetRekeyChannel(id) != nil
}

// GetRekeyChannel implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) GetRekeyChannel(id tlf.ID) <-chan error {
	rkq.queueMu.RLock()
	defer rkq.queueMu.RUnlock()
	for _, e := range rkq.queue {
		if e.id == id {
			return e.ch
		}
	}
	return nil
}

// Clear implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Clear() {
	channels := func() []chan error {
		rkq.queueMu.Lock()
		defer rkq.queueMu.Unlock()
		if rkq.cancel != nil {
			// cancel
			rkq.cancel()
			rkq.cancel = nil
		}
		// collect channels and clear queue
		var channels []chan error
		for _, e := range rkq.queue {
			channels = append(channels, e.ch)
		}
		rkq.queue = make([]rekeyQueueEntry, 0)
		return channels
	}()
	for _, c := range channels {
		c <- context.Canceled
		close(c)
	}
}

// Wait implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Wait(ctx context.Context) error {
	return rkq.wg.Wait(ctx)
}

// CtxRekeyTagKey is the type used for unique context tags within an
// enqueued Rekey.
type CtxRekeyTagKey int

const (
	// CtxRekeyIDKey is the type of the tag for unique operation IDs
	// within an enqueued Rekey.
	CtxRekeyIDKey CtxRekeyTagKey = iota
)

// CtxRekeyOpID is the display name for the unique operation
// enqueued rekey ID tag.
const CtxRekeyOpID = "REKEYID"

// Dedicated goroutine to process the rekey queue.
func (rkq *RekeyQueueStandard) processRekeys(ctx context.Context, hasWorkCh chan struct{}) {
	for {
		select {
		case <-hasWorkCh:
			for {
				id := rkq.peek()
				if id == tlf.NullID {
					break
				}
				func() {
					defer rkq.wg.Done()
					// Assign an ID to this rekey operation so we can track it.
					newCtx := ctxWithRandomIDReplayable(ctx, CtxRekeyIDKey,
						CtxRekeyOpID, nil)
					err := rkq.config.KBFSOps().Rekey(newCtx, id)
					if ch := rkq.dequeue(); ch != nil {
						ch <- err
						close(ch)
					}
				}()
				if ctx.Err() != nil {
					close(hasWorkCh)
					return
				}
			}
		case <-ctx.Done():
			close(hasWorkCh)
			return
		}
	}
}

func (rkq *RekeyQueueStandard) peek() tlf.ID {
	rkq.queueMu.Lock()
	defer rkq.queueMu.Unlock()
	if len(rkq.queue) != 0 {
		return rkq.queue[0].id
	}
	return tlf.NullID
}

func (rkq *RekeyQueueStandard) dequeue() chan<- error {
	rkq.queueMu.Lock()
	defer rkq.queueMu.Unlock()
	if len(rkq.queue) == 0 {
		return nil
	}
	ch := rkq.queue[0].ch
	rkq.queue = rkq.queue[1:]
	return ch
}
