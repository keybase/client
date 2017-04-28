package chat

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/gregor1"
)

type BackgroundConvLoader struct {
	globals.Contextified
	connected bool
}

var _ types.ConvLoader = (*BackgroundConvLoader)(nil)

func NewBackgroundConvLoader(g *globals.Context) *BackgroundConvLoader {
	return &BackgroundConvLoader{
		Contextified: globals.NewContextified(g),
	}
}

func (b *BackgroundConvLoader) Connected(ctx context.Context) {
	b.connected = true

	// Wake up loader loop on reconnect
	// b.Debug(ctx, "reconnected: forcing deliver loop run")
	// b.reconnectCh <- struct{}{}
}

func (b *BackgroundConvLoader) Disconnected(ctx context.Context) {
	// s.Debug(ctx, "disconnected: all errors from now on will be permanent")
	b.connected = false
}

func (b *BackgroundConvLoader) IsOffline() bool {
	return !b.connected
}

func (b *BackgroundConvLoader) Start(ctx context.Context, uid gregor1.UID) {
	/*
		s.Lock()
		defer s.Unlock()

		<-s.doStop(ctx)

		s.outbox = storage.NewOutbox(s.G(), uid)
		s.outbox.SetClock(s.clock)

		s.delivering = true
		go s.deliverLoop()
	*/
}

func (s *BackgroundConvLoader) Stop(ctx context.Context) chan struct{} {
	/*
		s.Lock()
		defer s.Unlock()
		return s.doStop(ctx)
	*/
	return make(chan struct{})
}
