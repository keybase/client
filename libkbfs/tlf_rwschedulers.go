package libkbfs

import (
	"sync"

	"github.com/keybase/kbfs/util"
)

// TlfRWSchedulers tracks RWScheduler objects on a
// per-top-level-folder basis, in a goroutine-safe way.
type TlfRWSchedulers struct {
	// TODO: Make this an LRU in case the number of directories is big
	chans     map[TlfID]util.RWScheduler
	chansLock sync.RWMutex
	config    Config
	factory   func(int) util.RWScheduler
}

// NewTlfRWSchedulers constructs a new TlfRWSchedulers object.
func NewTlfRWSchedulers(config Config) *TlfRWSchedulers {
	return &TlfRWSchedulers{
		chans:   make(map[TlfID]util.RWScheduler),
		config:  config,
		factory: util.NewRWChannel,
	}
}

// GetTlfChan safely gets or creates a read-write lock for the given
// top-level folder.
func (t *TlfRWSchedulers) GetTlfChan(tlfID TlfID) util.RWScheduler {
	t.chansLock.RLock()
	if rwchan, ok := t.chans[tlfID]; ok {
		t.chansLock.RUnlock()
		return rwchan
	}

	// lock it for real, and try again
	t.chansLock.RUnlock()
	t.chansLock.Lock()
	defer t.chansLock.Unlock()
	rwchan, ok := t.chans[tlfID]
	if !ok {
		rwchan = t.factory(t.config.ReqsBufSize())
		t.chans[tlfID] = rwchan
	}
	return rwchan
}

// Shutdown closes all RWSchedulers.  This must be called at most once.
func (t *TlfRWSchedulers) Shutdown() {
	t.chansLock.Lock()
	defer t.chansLock.Unlock()
	chans := make([]chan struct{}, 0, len(t.chans))
	for _, rwchan := range t.chans {
		chans = append(chans, rwchan.Shutdown())
	}
	for _, donechan := range chans {
		<-donechan
	}
}
