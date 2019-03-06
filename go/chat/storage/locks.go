package storage

import (
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
)

type locksRepo struct {
	Inbox, Outbox, Version, ConvFailures sync.Mutex
	StorageLockTab                       *libkb.LockTable
}

var initLocksOnce sync.Once
var locks *locksRepo

func initLocksRepoOnce(g *globals.Context) {
	initLocksOnce.Do(func() {
		locks = &locksRepo{}
		locks.StorageLockTab = &libkb.LockTable{}
	})
}
