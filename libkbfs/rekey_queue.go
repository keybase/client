package libkbfs

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"
)

// RekeyQueueStandard implements the RekeyQueue interface.
type RekeyQueueStandard struct {
	config    Config
	hasWorkCh chan struct{}
	cancel    context.CancelFunc
	queueMu   sync.RWMutex         // protects the below
	queue     map[TlfID]chan error // if we end up caring about order we should add a slice
}

// Test that RekeyQueueStandard fully implements the RekeyQueue interface.
var _ RekeyQueue = (*RekeyQueueStandard)(nil)

// NewRekeyQueueStandard instantiates a new rekey worker.
func NewRekeyQueueStandard(config Config) *RekeyQueueStandard {
	rkq := &RekeyQueueStandard{
		config:    config,
		queue:     make(map[TlfID]chan error),
		hasWorkCh: make(chan struct{}, 1),
	}
	var ctx context.Context
	ctx, rkq.cancel = context.WithCancel(context.Background())
	go rkq.processRekeys(ctx)
	return rkq
}

// Enqueue implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Enqueue(id TlfID) <-chan error {
	c := make(chan error, 1)
	err := func() error {
		rkq.queueMu.Lock()
		defer rkq.queueMu.Unlock()
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
	// poke the channel
	select {
	case rkq.hasWorkCh <- struct{}{}:
	default:
	}
	return c
}

// IsRekeyPending implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) IsRekeyPending(id TlfID) bool {
	rkq.queueMu.RLock()
	defer rkq.queueMu.RUnlock()
	_, exists := rkq.queue[id]
	return exists
}

// Clear implements the RekeyQueue interface for RekeyQueueStandard.
func (rkq *RekeyQueueStandard) Clear() {
	rkq.cancel()
	channels := func() []chan error {
		rkq.queueMu.Lock()
		defer rkq.queueMu.Unlock()
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

// Dedicated goroutine to process the rekey queue.
func (rkq *RekeyQueueStandard) processRekeys(ctx context.Context) {
	for {
		select {
		case <-rkq.hasWorkCh:
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
				err := rkq.config.KBFSOps().Rekey(ctx, id)
				rkq.dequeue(id, err)
				if ctx.Err() != nil {
					close(rkq.hasWorkCh)
					return
				}
			}
		case <-ctx.Done():
			close(rkq.hasWorkCh)
			return
		}
	}
}
