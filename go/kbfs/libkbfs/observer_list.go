// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// observerList is a thread-safe list of observers.
type observerList struct {
	lock      sync.RWMutex
	observers []Observer
}

func newObserverList() *observerList {
	return &observerList{}
}

// It's the caller's responsibility to make sure add isn't called
// twice for the same Observer.
func (ol *observerList) add(o Observer) {
	ol.lock.Lock()
	defer ol.lock.Unlock()
	ol.observers = append(ol.observers, o)
}

func (ol *observerList) remove(o Observer) {
	ol.lock.Lock()
	defer ol.lock.Unlock()
	for i, oldObs := range ol.observers {
		if oldObs == o {
			ol.observers = append(ol.observers[:i], ol.observers[i+1:]...)
			return
		}
	}
}

func (ol *observerList) localChange(
	ctx context.Context, node Node, write WriteRange) {
	ol.lock.RLock()
	defer ol.lock.RUnlock()
	for _, o := range ol.observers {
		o.LocalChange(ctx, node, write)
	}
}

func (ol *observerList) batchChanges(
	ctx context.Context, changes []NodeChange, affectedNodeIDs []NodeID) {
	ol.lock.RLock()
	defer ol.lock.RUnlock()
	for _, o := range ol.observers {
		o.BatchChanges(ctx, changes, affectedNodeIDs)
	}
}

func (ol *observerList) tlfHandleChange(
	ctx context.Context, newHandle *tlfhandle.Handle) {
	ol.lock.RLock()
	defer ol.lock.RUnlock()
	for _, o := range ol.observers {
		o.TlfHandleChange(ctx, newHandle)
	}
}

// syncedTlfObserverList is a thread-safe list of synced TLF observers.
type syncedTlfObserverList struct {
	lock      sync.RWMutex
	observers []SyncedTlfObserver
}

func newSyncedTlfObserverList() *syncedTlfObserverList {
	return &syncedTlfObserverList{}
}

// It's the caller's responsibility to make sure add isn't called
// twice for the same SyncedTlfObserver.
func (stol *syncedTlfObserverList) add(o SyncedTlfObserver) {
	stol.lock.Lock()
	defer stol.lock.Unlock()
	stol.observers = append(stol.observers, o)
}

func (stol *syncedTlfObserverList) remove(o SyncedTlfObserver) {
	stol.lock.Lock()
	defer stol.lock.Unlock()
	for i, oldObs := range stol.observers {
		if oldObs == o {
			stol.observers = append(stol.observers[:i], stol.observers[i+1:]...)
			return
		}
	}
}

func (stol *syncedTlfObserverList) fullSyncStarted(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision,
	waitCh <-chan struct{}) {
	stol.lock.RLock()
	defer stol.lock.RUnlock()
	for _, o := range stol.observers {
		o.FullSyncStarted(ctx, tlfID, rev, waitCh)
	}
}

func (stol *syncedTlfObserverList) syncModeChanged(
	ctx context.Context, tlfID tlf.ID, newMode keybase1.FolderSyncMode) {
	stol.lock.RLock()
	defer stol.lock.RUnlock()
	for _, o := range stol.observers {
		o.SyncModeChanged(ctx, tlfID, newMode)
	}
}
