package chat

import (
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

// sourceOfflinable implements the chat/types.Offlinable interface.
// It is meant to be embedded in inbox and conversation sources.
// It's main purpose is that IsOffline() will wait for 4s to see if any
// in progress connections succeed before returning.
type sourceOfflinable struct {
	globals.Contextified
	utils.DebugLabeler
	offline, delayed bool
	connected        chan bool
	sync.Mutex
}

var _ types.Offlinable = (*sourceOfflinable)(nil)

func newSourceOfflinable(g *globals.Context, labeler utils.DebugLabeler) *sourceOfflinable {
	return &sourceOfflinable{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
		connected:    makeConnectedChan(),
	}
}

func (s *sourceOfflinable) Connected(ctx context.Context) {
	defer s.Trace(ctx, func() error { return nil }, "Connected")()
	s.Lock()
	defer s.Unlock()
	s.Debug(ctx, "connected: offline to false")
	s.offline = false
	s.connected <- true
}

func (s *sourceOfflinable) Disconnected(ctx context.Context) {
	defer s.Trace(ctx, func() error { return nil }, "Disconnected")()
	s.Lock()
	defer s.Unlock()
	if s.offline {
		s.Debug(ctx, "already disconnected, ignoring disconnected callback")
		return
	}
	s.Debug(ctx, "disconnected: offline to true")
	s.offline = true
	s.delayed = false
	close(s.connected)
	s.connected = makeConnectedChan()
}

func (s *sourceOfflinable) IsOffline(ctx context.Context) bool {
	s.Lock()
	offline := s.offline
	connected := s.connected
	delayed := s.delayed
	s.Unlock()

	if offline {
		if delayed {
			s.Debug(ctx, "IsOffline: offline, but skipping delay since we already did it")
			return offline
		}
		if s.G().AppState.State() != keybase1.AppState_FOREGROUND {
			s.Debug(ctx, "IsOffline: offline, but not waiting for anything since not in foreground")
			return offline
		}
		select {
		case <-connected:
			s.Lock()
			defer s.Unlock()
			s.Debug(ctx, "IsOffline: waited and got %v", s.offline)
			return s.offline
		case <-time.After(4 * time.Second):
			s.Lock()
			defer s.Unlock()
			s.delayed = true
			s.Debug(ctx, "IsOffline: timed out")
			return s.offline
		}
	}
	return offline
}

// makeConnectedChan creates a buffered channel for Connected to signal that
// a connection happened.  The buffer size is 10 just to be extra-safe that
// a send on the channel won't block during its lifetime (a buffer size of
// 1 should be all that is required).
func makeConnectedChan() chan bool {
	return make(chan bool, 10)

}
