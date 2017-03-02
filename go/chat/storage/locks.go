package storage

import "sync"

type locksRepo struct {
	Storage, Inbox, Outbox sync.Mutex
}

var locks locksRepo
