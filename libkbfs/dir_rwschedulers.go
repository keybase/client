package libkbfs

import (
	"sync"

	"github.com/keybase/kbfs/util"
)

// DirRWSchedulers tracks RWScheduler objects on a
// per-top-level-folder basis, in a goroutine-safe way.
type DirRWSchedulers struct {
	// TODO: Make this an LRU in case the number of directories is big
	chans     map[DirID]util.RWScheduler
	chansLock sync.RWMutex
	config    Config
	factory   func(int) util.RWScheduler
}

// NewDirRWSchedulers constructs a new DirRWSchedulers object.
func NewDirRWSchedulers(config Config) *DirRWSchedulers {
	return &DirRWSchedulers{
		chans:   make(map[DirID]util.RWScheduler),
		config:  config,
		factory: util.NewRWChannel,
	}
}

// GetDirChan safely gets or creates a read-write lock for the given
// top-level folder.
func (d *DirRWSchedulers) GetDirChan(dir DirID) util.RWScheduler {
	d.chansLock.RLock()
	if rwchan, ok := d.chans[dir]; ok {
		d.chansLock.RUnlock()
		return rwchan
	}

	// lock it for real, and try again
	d.chansLock.RUnlock()
	d.chansLock.Lock()
	defer d.chansLock.Unlock()
	rwchan, ok := d.chans[dir]
	if !ok {
		rwchan = d.factory(d.config.ReqsBufSize())
		d.chans[dir] = rwchan
	}
	return rwchan
}

// Shutdown closes all RWSchedulers.  This must be called at most once.
func (d *DirRWSchedulers) Shutdown() {
	d.chansLock.Lock()
	defer d.chansLock.Unlock()
	chans := make([]chan struct{}, 0, len(d.chans))
	for _, rwchan := range d.chans {
		chans = append(chans, rwchan.Shutdown())
	}
	for _, donechan := range chans {
		<-donechan
	}
}
