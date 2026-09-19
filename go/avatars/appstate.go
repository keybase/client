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
	// flushes counts flushes; tests use it.
	flushes int
}

func (f *backgroundFlusher) start(m libkb.MetaContext, flush func(libkb.MetaContext)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.stopCh != nil {
		return
	}
	f.stopCh = make(chan struct{})
	f.doneCh = make(chan struct{})
	stopCh, doneCh := f.stopCh, f.doneCh
	// Armed here, not in the goroutine, so a change made before the goroutine
	// first runs still wakes it.
	state := m.G().MobileAppState.State()
	changed := m.G().MobileAppState.NextUpdate(state)
	go func() {
		defer close(doneCh)
		for {
			select {
			case <-changed:
			case <-stopCh:
				return
			}
			state = m.G().MobileAppState.State()
			changed = m.G().MobileAppState.NextUpdate(state)
			if state == keybase1.MobileAppState_BACKGROUND {
				flush(m)
				f.mu.Lock()
				f.flushes++
				f.mu.Unlock()
			}
		}
	}()
}

// stop ends the watcher goroutine and waits for it to exit.
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
