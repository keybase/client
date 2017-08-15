package chat

import (
	"sync"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

// sourceOfflinable implements the chat/types.Offlinable interface.
// It is meant to be embedded in inbox and conversation sources.
// It's main purpose is that IsOffline() will wait for 4s to see if any
// in progress connections succeed before returning.
type sourceOfflinable struct {
	utils.DebugLabeler
	offline   bool
	connected chan bool
	sync.Mutex
}

var _ types.Offlinable = (*sourceOfflinable)(nil)

func newSourceOfflinable(labeler utils.DebugLabeler) *sourceOfflinable {
	return &sourceOfflinable{
		DebugLabeler: labeler,
		connected:    makeConnectedChan(),
	}
}

func (s *sourceOfflinable) Connected(ctx context.Context) {
	s.Debug(ctx, "connected")
	s.Lock()
	defer s.Unlock()

	s.Debug(ctx, "connected: offline to false")
	s.offline = false
	s.connected <- true
}

func (s *sourceOfflinable) Disconnected(ctx context.Context) {
	s.Debug(ctx, "disconnected")
	s.Lock()
	defer s.Unlock()

	s.Debug(ctx, "disconnected: offline to true")

	s.offline = true
	close(s.connected)
	s.connected = makeConnectedChan()
}

func (s *sourceOfflinable) IsOffline(ctx context.Context) bool {
	s.Lock()
	offline := s.offline
	connected := s.connected
	s.Unlock()

	if offline {
		select {
		case <-connected:
			s.Lock()
			defer s.Unlock()
			s.Debug(ctx, "IsOffline: waited and got %v", s.offline)
			return s.offline
		case <-time.After(4 * time.Second):
			s.Debug(ctx, "IsOffline: timed out")
			return false
		}
	}

	return offline
}

func makeConnectedChan() chan bool {
	// connectedBuffer is the sourceOfflinable connected channel buffer size.
	// It is 10 just to be extra-safe that sends to the channel in
	// Connected will not block in the case of more than one Connect call
	// happening during the lifetime of the connected channel (which shouldn't
	// happen).
	const connectedBuffer = 10
	return make(chan bool, 10)

}
