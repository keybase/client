package libkbfs

import (
	"sync"

	"github.com/keybase/kbfs/util"
)

type DirRWChannels struct {
	// TODO: Make this an LRU in case the number of directories is big
	chans     map[DirId]*util.RWChannel
	chansLock sync.RWMutex
	config    Config
}

func NewDirRWChannels(config Config) *DirRWChannels {
	return &DirRWChannels{
		chans:  make(map[DirId]*util.RWChannel),
		config: config,
	}
}

// Safely get or create a read-write lock for the given directory
func (d *DirRWChannels) GetDirChan(dir DirId) *util.RWChannel {
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
		rwchan := util.NewRWChannel(d.config.ReqsBufSize())
		d.chans[dir] = rwchan
		return rwchan
	}
}
