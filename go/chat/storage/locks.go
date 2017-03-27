package storage

import "sync"

type locksRepo struct {
	Storage, Inbox, Outbox, Version sync.Mutex
}

var locks locksRepo
