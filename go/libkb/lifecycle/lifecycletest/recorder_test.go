// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package lifecycletest

import (
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// slowWakeSource is a Source whose replaced NextUpdate channels close only on
// wake, standing in for a recorder goroutine that hasn't been scheduled yet.
type slowWakeSource struct {
	mu      sync.Mutex
	state   keybase1.MobileAppState
	changed chan struct{}
	unwoken []chan struct{}
}

func (s *slowWakeSource) State() keybase1.MobileAppState {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state
}

func (s *slowWakeSource) NextUpdate(last keybase1.MobileAppState) <-chan struct{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	if last != s.state {
		ch := make(chan struct{})
		close(ch)
		return ch
	}
	return s.changed
}

func (s *slowWakeSource) update(state keybase1.MobileAppState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.state != state {
		s.state = state
		s.unwoken = append(s.unwoken, s.changed)
		s.changed = make(chan struct{})
	}
}

func (s *slowWakeSource) wake() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, ch := range s.unwoken {
		close(ch)
	}
	s.unwoken = nil
}

// A change and its reversal leave the value where it was; Sync must still
// wait for the recorder to wake and re-arm.
func TestRecorderSyncWaitsForChangeAndReversal(t *testing.T) {
	src := &slowWakeSource{state: keybase1.MobileAppState_FOREGROUND, changed: make(chan struct{})}
	r := NewRecorder(src)
	defer r.Stop()
	r.Sync(t)

	src.update(keybase1.MobileAppState_BACKGROUND)
	src.update(keybase1.MobileAppState_FOREGROUND)
	synced := make(chan struct{})
	go func() {
		r.Sync(t)
		close(synced)
	}()
	select {
	case <-synced:
		require.Fail(t, "Sync returned before the recorder woke for the change")
	case <-time.After(50 * time.Millisecond):
	}
	src.wake()
	select {
	case <-synced:
	case <-time.After(5 * time.Second):
		require.Fail(t, "Sync never returned")
	}
}
