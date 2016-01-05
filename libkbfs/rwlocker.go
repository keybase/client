package libkbfs

import "sync"

// A rwLocker represents an object that can be reader-locked and
// reader-unlocked as well as locked and unlocked.
type rwLocker interface {
	sync.Locker
	RLock()
	RUnlock()
}
