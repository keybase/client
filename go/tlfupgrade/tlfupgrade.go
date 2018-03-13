package tlfupgrade

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

type BackgroundTLFUpdater struct {
	libkb.Contextified

	initialWait time.Duration
	clock       clockwork.Clock
	shutdownCh  chan struct{}
	suspendCh   chan struct{}
}

func NewBackgroundTLFUpdater(g *libkb.GlobalContext) *BackgroundTLFUpdater {
	return &BackgroundTLFUpdater{
		Contextified: libkb.NewContextified(g),
		initialWait:  10 * time.Second,
		shutdownCh:   make(chan struct{}),
		suspendCh:    make(chan struct{}),
		clock:        clockwork.NewRealClock(),
	}
}

func (b *BackgroundTLFUpdater) debug(msg string, args ...interface{}) {
	b.G().Log.Debug("BackgroundTLFUpdater: %s", fmt.Sprintf(msg, args...))
}

func (b *BackgroundTLFUpdater) Run() {
	go b.monitorAppState()
}

func (b *BackgroundTLFUpdater) Shutdown() {

}

func (b *BackgroundTLFUpdater) monitorAppState() {
	for {
		state := <-b.G().AppState.NextUpdate()
		switch state {
		case keybase1.AppState_FOREGROUND:
			// wait for the initial wait time before waking up the upgrade threads
			b.clock.Sleep(b.initialWait)
			b.
		case keybase1.AppState_BACKGROUND:
			b.debug("backgrounded, suspending upgrade thread")
			b.suspendCh <- struct{}{}
		}
	}
}

func (b *BackgroundTLFUpdater) runAppType(appType keybase1.TeamApplication) {
	b.clock.Sleep(b.initialWait)
	for {
		select {}
	}
}
