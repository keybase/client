package libkbfs

import (
	"golang.org/x/net/context"
	"reflect"
)

// CoalescingContext allows many contexts to be treated as one.  It waits on
// all its contexts' Context.Done() channels, and when all of them have
// returned, this CoalescingContext is canceled. At any point, a context can be
// added to the list, and will subsequently also be part of the wait condition.
type CoalescingContext struct {
	context.Context
	doneCh   chan struct{}
	mutateCh chan context.Context
	selects  []reflect.SelectCase
}

func (ctx *CoalescingContext) loop() {
	for {
		selects := append([]reflect.SelectCase{{
			Dir:  reflect.SelectRecv,
			Chan: reflect.ValueOf(ctx.mutateCh),
		}}, ctx.selects...)
		chosen, val, _ := reflect.Select(selects)
		if chosen == 0 {
			// request to mutate the select list
			newCase := val.Interface().(context.Context)
			if newCase != nil {
				ctx.addContextLocked(newCase)
			}
		} else {
			chosen--
			// The chosen channel has been closed. Remove it from our select list.
			ctx.selects = append(ctx.selects[:chosen], ctx.selects[chosen+1:]...)
			// If we have no more selects available, the request is done.
			if len(ctx.selects) == 0 {
				close(ctx.doneCh)
				return
			}
		}
	}
}

func (ctx *CoalescingContext) addContextLocked(other context.Context) {
	ctx.selects = append(ctx.selects, reflect.SelectCase{
		Dir:  reflect.SelectRecv,
		Chan: reflect.ValueOf(other.Done()),
	})
}

func NewCoalescingContext(parent context.Context) *CoalescingContext {
	ctx := &CoalescingContext{
		Context:  context.Background(),
		doneCh:   make(chan struct{}),
		mutateCh: make(chan context.Context),
		selects:  make([]reflect.SelectCase, 0, 1),
	}
	ctx.addContextLocked(parent)
	go ctx.loop()
	return ctx
}

func (ctx *CoalescingContext) Done() <-chan struct{} {
	return ctx.doneCh
}

func (ctx *CoalescingContext) Err() error {
	select {
	case <-ctx.doneCh:
		return context.Canceled
	default:
	}
	return nil
}

func (ctx *CoalescingContext) AddContext(other context.Context) error {
	select {
	case ctx.mutateCh <- other:
		return nil
	case <-ctx.doneCh:
		return context.Canceled
	}
}
