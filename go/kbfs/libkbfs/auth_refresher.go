// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"sync"
	"sync/atomic"
)

// authRefresher runs one auth refresh at a time for a server
// connection. The server keeps one challenge per connection, so two
// refreshes at once replace each other's challenge and both fail. Each
// caller runs its own refresh, which reads the session when it starts,
// so the refresh that runs last authenticates the current user. The
// zero value is ready to use.
type authRefresher struct {
	initOnce sync.Once
	slot     chan struct{}
	// waiting counts callers waiting for the slot; tests read it to
	// know a refresh has queued.
	waiting atomic.Int32
}

// refresh waits for any running refresh to finish and then runs `do`.
// If ctx ends first, it returns without running `do`.
func (r *authRefresher) refresh(
	ctx context.Context, do func(context.Context),
) {
	r.initOnce.Do(func() { r.slot = make(chan struct{}, 1) })
	r.waiting.Add(1)
	select {
	case r.slot <- struct{}{}:
		r.waiting.Add(-1)
	case <-ctx.Done():
		r.waiting.Add(-1)
		return
	}
	defer func() { <-r.slot }()
	if ctx.Err() != nil {
		return
	}
	do(ctx)
}
