package libkbfs

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"
)

// RekeyQueueStandard implements the RekeyQueue interface.
type RekeyQueueStandard struct {
	config    Config
	queueMu   sync.RWMutex         // protects all of the below
	queue     map[TlfID]chan error // if we end up caring about order we should add a slice
	hasWorkCh chan struct{}
	cancel    context.CancelFunc
	wg        RepeatedWaitGroup
}

// Test that RekeyQueueStandard fully implements the RekeyQueue interface.
var _ RekeyQueue = (*RekeyQueueStandard)(nil)

// NewRekeyQueueStandard instantiates a new rekey worker.
func NewRekeyQueueStandard(config Config) *RekeyQueueStandard {
	rkq := &RekeyQueueStandard{
		config: config,
		queue:  make(map[TlfID]chan error),
	}
	return rkq
}

// Enqueue implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Enqueue(id TlfID) <-chan error {
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
		if _, exists := rkq.queue[id]; exists {
			return fmt.Errorf("folder %s already queued for rekey", id)
		}
		rkq.queue[id] = c
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
func (rkq *RekeyQueueStandard) IsRekeyPending(id TlfID) bool {
	return rkq.GetRekeyChannel(id) != nil
}

// GetRekeyChannel implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) GetRekeyChannel(id TlfID) <-chan error {
	rkq.queueMu.RLock()
	defer rkq.queueMu.RUnlock()
	if c, exists := rkq.queue[id]; exists {
		return c
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
		for _, c := range rkq.queue {
			channels = append(channels, c)
		}
		rkq.queue = make(map[TlfID]chan error)
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

// dequeue is a helper to remove a folder from the rekey queue.
func (rkq *RekeyQueueStandard) dequeue(id TlfID, err error) {
	c := func() chan error {
		rkq.queueMu.Lock()
		defer rkq.queueMu.Unlock()
		if c, ok := rkq.queue[id]; ok {
			delete(rkq.queue, id)
			return c
		}
		return nil
	}()
	if c != nil {
		c <- err
		close(c)
	}
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
				id := func() TlfID {
					rkq.queueMu.Lock()
					defer rkq.queueMu.Unlock()
					for first := range rkq.queue {
						return first
					}
					return NullTlfID
				}()
				if id == NullTlfID {
					break
				}

				func() {
					defer rkq.wg.Done()
					// Assign an ID to this rekey operation so we can track it.
					newCtx := ctxWithRandomID(ctx, CtxRekeyIDKey,
						CtxRekeyOpID, nil)
					err := rkq.config.KBFSOps().Rekey(newCtx, id)
					rkq.dequeue(id, err)
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
