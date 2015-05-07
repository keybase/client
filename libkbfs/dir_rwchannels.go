package libkbfs

import (
	"sync"

	"github.com/keybase/kbfs/util"
)

type DirRWChannels struct {
	// TODO: Make this an LRU in case the number of directories is big
	chans     map[DirId]util.RWChannel
	chansLock sync.RWMutex
	config    Config
	factory   func(int) util.RWChannel
}

func NewDirRWChannels(config Config) *DirRWChannels {
	return &DirRWChannels{
		chans:   make(map[DirId]util.RWChannel),
		config:  config,
		factory: util.NewRWChannelImpl,
	}
}

// Safely get or create a read-write lock for the given directory
func (d *DirRWChannels) GetDirChan(dir DirId) util.RWChannel {
	d.chansLock.RLock()
	if rwchan, ok := d.chans[dir]; ok {
		d.chansLock.RUnlock()
		return rwchan
	}

	// lock it for real, and try again
	d.chansLock.RUnlock()
	d.chansLock.Lock()
	defer d.chansLock.Unlock()
	if rwchan, ok := d.chans[dir]; ok {
		return rwchan
	} else {
		rwchan := d.factory(d.config.ReqsBufSize())
		d.chans[dir] = rwchan
		return rwchan
	}
}

// Shutdown closes all RWChannels.  This must be called at most once.
func (d *DirRWChannels) Shutdown() {
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
