package libkbfs

import (
	"reflect"
	"time"

	"golang.org/x/net/context"
)

// CoalescingContext allows many contexts to be treated as one.  It waits on
// all its contexts' Context.Done() channels, and when all of them have
// returned, this CoalescingContext is canceled. At any point, a context can be
// added to the list, and will subsequently also be part of the wait condition.
// TODO: add timeout channel in case there is a goroutine leak.
type CoalescingContext struct {
	context.Context
	doneCh   chan struct{}
	mutateCh chan context.Context
	selects  []reflect.SelectCase
}

const (
	mutateChanSelectIndex       int = 0
	closeChanSelectIndex        int = 1
	numExplicitlyHandledSelects int = 2
)

func (ctx *CoalescingContext) loop() {
	for {
		chosen, val, _ := reflect.Select(ctx.selects)
		switch chosen {
		case mutateChanSelectIndex:
			// request to mutate the select list
			newCase := val.Interface().(context.Context)
			if newCase != nil {
				ctx.appendContext(newCase)
			}
		case closeChanSelectIndex:
			// Done
			close(ctx.doneCh)
			return
		default:
			// The chosen channel has been closed. Remove it from our select list.
			ctx.selects = append(ctx.selects[:chosen], ctx.selects[chosen+1:]...)
			// If we have no more selects available, the request is done.
			if len(ctx.selects) == numExplicitlyHandledSelects {
				close(ctx.doneCh)
				return
			}
		}
	}
}

func (ctx *CoalescingContext) appendContext(other context.Context) {
	ctx.selects = append(ctx.selects, reflect.SelectCase{
		Dir:  reflect.SelectRecv,
		Chan: reflect.ValueOf(other.Done()),
	})
}

// NewCoalescingContext creates a new CoalescingContext. The context _must_ be
// canceled to avoid a goroutine leak.
func NewCoalescingContext(parent context.Context) (*CoalescingContext, context.CancelFunc) {
	ctx := &CoalescingContext{
		// Make the parent's `Value()` method available to consumers of this
		// context. For example, this maintains the parent's log debug tags.
		// TODO: Make _all_ parents' values available.
		Context:  parent,
		doneCh:   make(chan struct{}),
		mutateCh: make(chan context.Context),
	}
	closeCh := make(chan struct{})
	ctx.selects = []reflect.SelectCase{
		{
			Dir:  reflect.SelectRecv,
			Chan: reflect.ValueOf(ctx.mutateCh),
		},
		{
			Dir:  reflect.SelectRecv,
			Chan: reflect.ValueOf(closeCh),
		},
	}
	ctx.appendContext(parent)
	go ctx.loop()
	cancelFunc := func() {
		select {
		case <-closeCh:
		default:
			close(closeCh)
		}
	}
	return ctx, cancelFunc
}

// Deadline overrides the default parent's Deadline().
func (ctx *CoalescingContext) Deadline() (time.Time, bool) {
	return time.Time{}, false
}

// Done returns a channel that is closed when the CoalescingContext is
// canceled.
func (ctx *CoalescingContext) Done() <-chan struct{} {
	return ctx.doneCh
}

// Err returns context.Canceled if the CoalescingContext has been canceled, and
// nil otherwise.
func (ctx *CoalescingContext) Err() error {
	select {
	case <-ctx.doneCh:
		return context.Canceled
	default:
	}
	return nil
}

// AddContext adds a context to the set of contexts that we're waiting on.
func (ctx *CoalescingContext) AddContext(other context.Context) error {
	select {
	case ctx.mutateCh <- other:
		return nil
	case <-ctx.doneCh:
		return context.Canceled
	}
}
