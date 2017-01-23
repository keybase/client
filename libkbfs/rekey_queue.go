// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/keybase/kbfs/tlf"

	"golang.org/x/net/context"
)

const (
	numRekeyWorkers = 64
	rekeyQueueSize  = 1024 // 24 KB
)

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

type rekeyQueueEntry struct {
	id tlf.ID
	ch chan error
}

// RekeyQueueStandard implements the RekeyQueue interface.
type RekeyQueueStandard struct {
	config Config
	log    logger.Logger
	queue  chan rekeyQueueEntry

	wg kbfssync.RepeatedWaitGroup

	lock     sync.RWMutex // protects all of the below
	pendings map[tlf.ID]<-chan error
	// cancel, if non-nil, is for all spawned workers. If nil, no workers should
	// be running. Calling cancel would cause all workers to stop.
	cancel context.CancelFunc
}

// Test that RekeyQueueStandard fully implements the RekeyQueue interface.
var _ RekeyQueue = (*RekeyQueueStandard)(nil)

// NewRekeyQueueStandard instantiates a new rekey worker.
func NewRekeyQueueStandard(config Config) *RekeyQueueStandard {
	log := config.MakeLogger("RQ")
	rkq := &RekeyQueueStandard{
		config:   config,
		log:      log,
		queue:    make(chan rekeyQueueEntry, rekeyQueueSize),
		pendings: make(map[tlf.ID]<-chan error),
	}
	return rkq
}

func (rkq *RekeyQueueStandard) doneLocked(entry rekeyQueueEntry, err error) {
	entry.ch <- err
	close(entry.ch)
	delete(rkq.pendings, entry.id)
	rkq.wg.Done()
}

func (rkq *RekeyQueueStandard) done(entry rekeyQueueEntry, err error) {
	rkq.lock.Lock()
	defer rkq.lock.Unlock()
	rkq.doneLocked(entry, err)
}

func (rkq *RekeyQueueStandard) work(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case entry := <-rkq.queue:
			func() {
				var err error
				defer rkq.done(entry, err) // deferred in case a panic happens below
				newCtx := ctxWithRandomIDReplayable(ctx, CtxRekeyIDKey,
					CtxRekeyOpID, nil)
				rkq.log.CDebugf(newCtx, "Processing rekey for %s", entry.id)
				err = rkq.config.KBFSOps().Rekey(newCtx, entry.id)
			}()
		}
	}
}

func (rkq *RekeyQueueStandard) ensureRunningLocked() {
	if rkq.cancel != nil {
		return
	}
	var ctx context.Context
	ctx, rkq.cancel = context.WithCancel(context.Background())
	for i := 0; i < numRekeyWorkers; i++ {
		go rkq.work(ctx)
	}
}

// Enqueue implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Enqueue(id tlf.ID) <-chan error {
	rkq.log.Debug("Enqueueing %s for rekey", id)

	if ch := rkq.GetRekeyChannel(id); ch != nil {
		return ch
	}

	rkq.wg.Add(1)

	rkq.lock.Lock()
	defer rkq.lock.Unlock()

	// Now we are locked, check again in case another one slips in. This wouldn't
	// matter that much since Rekey is idempotent. But since we have the lock
	// already, it won't hurt.
	if ch := rkq.getRekeyChannelRLocked(id); ch != nil {
		return ch
	}

	rkq.ensureRunningLocked()

	ch := make(chan error, 1)
	rkq.pendings[id] = ch

	select {
	case rkq.queue <- rekeyQueueEntry{id: id, ch: ch}:
	default:
		// The queue is full; avoid blocking by spawning a goroutine.
		rkq.log.Debug("Rekey queue is full; enqueuing %s in the background", id)
		go func() { rkq.queue <- rekeyQueueEntry{id: id, ch: ch} }()
	}

	return ch
}

// IsRekeyPending implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) IsRekeyPending(id tlf.ID) bool {
	rkq.lock.RLock()
	defer rkq.lock.RUnlock()
	_, ok := rkq.pendings[id]
	return ok
}

// GetRekeyChannel implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) GetRekeyChannel(id tlf.ID) <-chan error {
	rkq.lock.RLock()
	defer rkq.lock.RUnlock()
	return rkq.getRekeyChannelRLocked(id)
}

func (rkq *RekeyQueueStandard) getRekeyChannelRLocked(id tlf.ID) <-chan error {
	if ch, ok := rkq.pendings[id]; ok {
		return ch
	}
	return nil
}

// Clear implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Clear() {
	rkq.lock.Lock()
	defer rkq.lock.Unlock()
	if rkq.cancel == nil {
		return
	}

	rkq.cancel()
	for more := true; more; { // drain rkq.queue
		select {
		case e := <-rkq.queue:
			rkq.doneLocked(e, context.Canceled)
		default:
			more = false
		}
	}
	rkq.cancel = nil
}

// Wait implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Wait(ctx context.Context) error {
	return rkq.wg.Wait(ctx)
}
