package storage

import "sync"

type locksRepo struct {
	Storage, Inbox, Outbox, Version, ConvFailures sync.Mutex
}

var locks locksRepo
