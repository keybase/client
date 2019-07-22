package storage

import (
	"sync"

	"github.com/keybase/client/go/libkb"
)

type locksRepo struct {
	Inbox, Outbox, ReadOutbox, Version, ConvFailures sync.Mutex
	StorageLockTab                                   *libkb.LockTable
}

var locks *locksRepo

func init() {
	locks = &locksRepo{}
	locks.StorageLockTab = libkb.NewLockTable()
}
