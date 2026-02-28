package libkbfs

import "context"

// OngoingWorkLimiter limits maximum number of routines that can work on a same
// type of thing at the same time. For example, it can be used for limiting
// number of ongoing rekeys.
type OngoingWorkLimiter struct {
	permits chan struct{}
}

// NewOngoingWorkLimiter creates a new *OngoingWorkLimiter with capacity of
// maxNumOngoingWorks.
func NewOngoingWorkLimiter(maxNumOngoingWorks int) *OngoingWorkLimiter {
	return &OngoingWorkLimiter{
		permits: make(chan struct{}, maxNumOngoingWorks),
	}
}

// WaitToStart blocks until the limiter would allow one more routine to start
// working on the thing.
func (owl *OngoingWorkLimiter) WaitToStart(ctx context.Context) error {
	select {
	case owl.permits <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Done tells the limiter that the caller is done working on the thing, and
// somebody else is free to start work.
func (owl *OngoingWorkLimiter) Done() {
	<-owl.permits
}
