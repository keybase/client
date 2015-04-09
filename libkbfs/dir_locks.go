package libkbfs

import (
	"sync"
)

type DirLocks struct {
	// TODO: Make this an LRU in case the number of directories is big
	locks     map[DirId]*sync.RWMutex
	locksLock sync.RWMutex
	config    Config
}

func NewDirLocks(config Config) *DirLocks {
	return &DirLocks{
		locks:  make(map[DirId]*sync.RWMutex),
		config: config,
	}
}

// Safely get or create a read-write lock for the given directory
func (d *DirLocks) GetDirLock(dir DirId) *sync.RWMutex {
	d.locksLock.RLock()
	if lock, ok := d.locks[dir]; ok {
		d.locksLock.RUnlock()
		return lock
	}

	// lock it for real, and try again
	d.locksLock.RUnlock()
	d.locksLock.Lock()
	defer d.locksLock.Unlock()
	if lock, ok := d.locks[dir]; ok {
		return lock
	} else {
		lock := &sync.RWMutex{}
		d.locks[dir] = lock
		return lock
	}
}
