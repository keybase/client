package avatars

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// backgroundFlusher runs flush each time the app enters BACKGROUND, from
// start until stop.
type backgroundFlusher struct {
	mu     sync.Mutex
	stopCh chan struct{}
	doneCh chan struct{}

	// flushes counts flushes, and monitorState/monitorWait record the state
	// the monitor last acted on and the change channel it waits on for it;
	// tests use them to wait until the monitor has caught up.
	flushes      int
	monitorState keybase1.MobileAppState
	monitorWait  <-chan struct{}
}

func (f *backgroundFlusher) start(m libkb.MetaContext, flush func(libkb.MetaContext)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.stopCh != nil {
		return
	}
	f.stopCh = make(chan struct{})
	f.doneCh = make(chan struct{})
	go f.monitor(m, m.G().MobileAppState.State(), flush, f.stopCh, f.doneCh)
}

// stop ends the monitor and waits for it to exit.
func (f *backgroundFlusher) stop() {
	f.mu.Lock()
	stopCh, doneCh := f.stopCh, f.doneCh
	f.stopCh, f.doneCh = nil, nil
	f.mu.Unlock()
	if stopCh == nil {
		return
	}
	close(stopCh)
	<-doneCh
}

func (f *backgroundFlusher) monitor(m libkb.MetaContext, state keybase1.MobileAppState, flush func(libkb.MetaContext),
	stopCh, doneCh chan struct{},
) {
	defer close(doneCh)
	for {
		next := m.G().MobileAppState.NextUpdate(state)
		f.mu.Lock()
		f.monitorState, f.monitorWait = state, next
		f.mu.Unlock()
		select {
		case <-next:
		case <-stopCh:
			return
		}
		state = m.G().MobileAppState.State()
		if state == keybase1.MobileAppState_BACKGROUND {
			flush(m)
			f.mu.Lock()
			f.flushes++
			f.mu.Unlock()
		}
	}
}
