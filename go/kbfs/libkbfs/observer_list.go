// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/kbfs/tlfhandle"
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
