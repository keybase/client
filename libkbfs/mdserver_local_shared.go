// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"
)

func checkMDPerms(ctx context.Context, codec Codec, kbpki KBPKI,
	mergedMasterHead *RootMetadataSigned, checkWrite bool,
	newMd *RootMetadataSigned) (bool, error) {
	if mergedMasterHead == nil {
		// TODO: the real mdserver will actually reverse
		// lookup the folder handle and check that the UID is
		// listed.
		return true, nil
	}
	_, user, err := kbpki.GetCurrentUserInfo(ctx)
	if err != nil {
		return false, err
	}
	h, err := mergedMasterHead.MD.MakeBareTlfHandle()
	if err != nil {
		return false, err
	}
	isWriter := h.IsWriter(user)
	isReader := h.IsReader(user)
	if checkWrite {
		// if this is a reader, are they acting within their
		// restrictions?
		if !isWriter && isReader && newMd != nil {
			return newMd.MD.IsValidRekeyRequest(
				codec, &mergedMasterHead.MD, user)
		}
		return isWriter, nil
	}
	return isWriter || isReader, nil
}

// Helper to aid in enforcement that only specified public keys can
// access TLF metadata. mergedMasterHead can be nil, in which case
// true is returned.
func isReader(ctx context.Context, codec Codec, kbpki KBPKI,
	mergedMasterHead *RootMetadataSigned) (bool, error) {
	return checkMDPerms(
		ctx, codec, kbpki, mergedMasterHead, false, nil)
}

// Helper to aid in enforcement that only specified public keys can
// access TLF metadata. mergedMasterHead can be nil, in which case
// true is returned.
func isWriterOrValidRekey(ctx context.Context, codec Codec, kbpki KBPKI,
	mergedMasterHead *RootMetadataSigned,
	newMd *RootMetadataSigned) (bool, error) {
	return checkMDPerms(
		ctx, codec, kbpki, mergedMasterHead, true, newMd)
}

type mdServerLocalUpdateManager struct {
	// Protects observers and sessionHeads.
	lock sync.Mutex
	// Multiple local instances of mdServerLocal could share a
	// reference to this map and sessionHead, and we use that to
	// ensure that all observers are fired correctly no matter
	// which local instance gets the Put() call.
	observers    map[TlfID]map[mdServerLocal]chan<- error
	sessionHeads map[TlfID]mdServerLocal
}

func newMDServerLocalUpdateManager() *mdServerLocalUpdateManager {
	return &mdServerLocalUpdateManager{
		observers:    make(map[TlfID]map[mdServerLocal]chan<- error),
		sessionHeads: make(map[TlfID]mdServerLocal),
	}
}

func (m *mdServerLocalUpdateManager) setHead(id TlfID, server mdServerLocal) {
	m.lock.Lock()
	defer m.lock.Unlock()

	m.sessionHeads[id] = server

	// now fire all the observers that aren't from this session
	for k, v := range m.observers[id] {
		if k != server {
			v <- nil
			close(v)
			delete(m.observers[id], k)
		}
	}
	if len(m.observers[id]) == 0 {
		delete(m.observers, id)
	}
}

func (m *mdServerLocalUpdateManager) registerForUpdate(
	id TlfID, currHead, currMergedHeadRev MetadataRevision,
	server mdServerLocal) <-chan error {
	m.lock.Lock()
	defer m.lock.Unlock()

	c := make(chan error, 1)
	if currMergedHeadRev > currHead && server != m.sessionHeads[id] {
		c <- nil
		close(c)
		return c
	}

	if _, ok := m.observers[id]; !ok {
		m.observers[id] = make(map[mdServerLocal]chan<- error)
	}

	// Otherwise, this is a legit observer.  This assumes that each
	// client will be using a unique instance of MDServerLocal.
	if _, ok := m.observers[id][server]; ok {
		// If the local node registers something twice, it indicates a
		// fatal bug.  Note that in the real MDServer implementation,
		// we should allow this, in order to make the RPC properly
		// idempotent.
		panic(fmt.Errorf("Attempted double-registration for MDServerLocal %v",
			server))
	}
	m.observers[id][server] = c
	return c
}
