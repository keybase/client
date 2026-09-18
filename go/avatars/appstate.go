package avatars

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// backgroundFlusher runs flush each time the app enters BACKGROUND, from
// start until stop.
type backgroundFlusher struct {
	mu      sync.Mutex
	stopCh  chan struct{}
	watcher *libkb.AppStateWatcher
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
	f.watcher = m.G().MobileAppState.NewWatcher()
	stopCh, w := f.stopCh, f.watcher
	go w.Run(m.G().MobileAppState.State(), stopCh, func(state keybase1.MobileAppState) bool {
		if state == keybase1.MobileAppState_BACKGROUND {
			flush(m)
			f.mu.Lock()
			f.flushes++
			f.mu.Unlock()
		}
		return true
	})
}

// stop ends the watcher and waits for it to exit.
func (f *backgroundFlusher) stop() {
	f.mu.Lock()
	stopCh, w := f.stopCh, f.watcher
	f.stopCh, f.watcher = nil, nil
	f.mu.Unlock()
	if stopCh == nil {
		return
	}
	close(stopCh)
	w.Wait()
}
