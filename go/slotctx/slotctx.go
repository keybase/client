package slotctx

import (
	"context"
	"sync"
)

// Slot is a slot in which only one context can thrive.
type Slot struct {
	mu     sync.Mutex
	cancel context.CancelFunc
}

func New() *Slot {
	return &Slot{}
}

// Use derives a context bound to the slot.
// Cancels any context previously bound to the slot.
func (s *Slot) Use(ctx context.Context) context.Context {
	ctx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	s.cancel, cancel = cancel, s.cancel
	s.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	return ctx
}

// Stop cancels the running task if there is one.
func (s *Slot) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}
}

// PrioritySlot is a slot in which only one context can thrive.
type PrioritySlot struct {
	mu       sync.Mutex
	cancel   context.CancelFunc
	priority int
	shutdown bool
}

func NewPriority() *PrioritySlot {
	return &PrioritySlot{}
}

// Use derives a new context.
// Whichever of the argument and the incumbent are lower priority is canceled.
// In a tie the incumbent is canceled.
func (s *PrioritySlot) Use(ctx context.Context, priority int) context.Context {
	ctx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.shutdown {
		// Not accepting new processes.
		cancel()
		return ctx
	}
	if s.cancel == nil {
		// First use
		s.cancel = cancel
		s.priority = priority
		return ctx
	}
	if s.priority <= priority {
		// Argument wins
		s.cancel()
		s.cancel = cancel
		s.priority = priority
		return ctx
	}
	// Incumbent wins
	cancel()
	return ctx
}

// Stop cancels the running task if there is one.
func (s *PrioritySlot) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
		s.priority = 0
	}
}

// Shutdown disables the slot forever.
func (s *PrioritySlot) Shutdown() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
		s.priority = 0
	}
	s.shutdown = true
}
