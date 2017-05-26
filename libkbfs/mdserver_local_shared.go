// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// TODO: Have the functions below wrap their errors.

// Helper to aid in enforcement that only specified public keys can
// access TLF metadata. mergedMasterHead can be nil, in which case
// true is returned.
func isReader(ctx context.Context, teamMemChecker TeamMembershipChecker,
	currentUID keybase1.UID, mergedMasterHead BareRootMetadata,
	extra ExtraMetadata) (bool, error) {
	h, err := mergedMasterHead.MakeBareTlfHandle(extra)
	if err != nil {
		return false, err
	}

	if h.Type() == tlf.SingleTeam {
		isReader, err := teamMemChecker.IsTeamReader(
			ctx, h.Writers[0].AsTeamOrBust(), currentUID)
		if err != nil {
			return false, kbfsmd.ServerError{Err: err}
		}
		return isReader, nil
	}

	return h.IsReader(currentUID.AsUserOrTeam()), nil
}

// Helper to aid in enforcement that only specified public keys can
// access TLF metadata. mergedMasterHead can be nil, in which case
// true is returned.
func isWriterOrValidRekey(ctx context.Context,
	teamMemChecker TeamMembershipChecker, codec kbfscodec.Codec,
	currentUID keybase1.UID, mergedMasterHead, newMd BareRootMetadata,
	prevExtra, extra ExtraMetadata) (
	bool, error) {
	h, err := mergedMasterHead.MakeBareTlfHandle(prevExtra)
	if err != nil {
		return false, err
	}

	if h.Type() == tlf.SingleTeam {
		isWriter, err := teamMemChecker.IsTeamWriter(
			ctx, h.Writers[0].AsTeamOrBust(), currentUID)
		if err != nil {
			return false, kbfsmd.ServerError{Err: err}
		}
		// Team TLFs can't be rekeyed, so readers aren't ever valid.
		return isWriter, nil
	}

	if h.IsWriter(currentUID.AsUserOrTeam()) {
		return true, nil
	}

	if h.IsReader(currentUID.AsUserOrTeam()) {
		// if this is a reader, are they acting within their
		// restrictions?
		return newMd.IsValidRekeyRequest(
			codec, mergedMasterHead, currentUID, prevExtra, extra)
	}

	return false, nil
}

// mdServerLocalTruncateLockManager manages the truncate locks for a
// set of TLFs. Note that it is not goroutine-safe.
type mdServerLocalTruncateLockManager struct {
	// TLF ID -> device crypt public key.
	locksDb map[tlf.ID]kbfscrypto.CryptPublicKey
}

func newMDServerLocalTruncatedLockManager() mdServerLocalTruncateLockManager {
	return mdServerLocalTruncateLockManager{
		locksDb: make(map[tlf.ID]kbfscrypto.CryptPublicKey),
	}
}

func (m mdServerLocalTruncateLockManager) truncateLock(
	deviceKey kbfscrypto.CryptPublicKey, id tlf.ID) (bool, error) {
	lockKey, ok := m.locksDb[id]
	if !ok {
		m.locksDb[id] = deviceKey
		return true, nil
	}

	if lockKey == deviceKey {
		// idempotent
		return true, nil
	}

	// Locked by someone else.
	return false, kbfsmd.ServerErrorLocked{}
}

func (m mdServerLocalTruncateLockManager) truncateUnlock(
	deviceKey kbfscrypto.CryptPublicKey, id tlf.ID) (bool, error) {
	lockKey, ok := m.locksDb[id]
	if !ok {
		// Already unlocked.
		return true, nil
	}

	if lockKey == deviceKey {
		delete(m.locksDb, id)
		return true, nil
	}

	// Locked by someone else.
	return false, kbfsmd.ServerErrorLocked{}
}

// mdServerLocalUpdateManager manages the observers for a set of TLFs
// referenced by multiple mdServerLocal instances sharing the same
// data. It is goroutine-safe.
type mdServerLocalUpdateManager struct {
	// Protects observers and sessionHeads.
	lock         sync.Mutex
	observers    map[tlf.ID]map[mdServerLocal]chan<- error
	sessionHeads map[tlf.ID]mdServerLocal
}

func newMDServerLocalUpdateManager() *mdServerLocalUpdateManager {
	return &mdServerLocalUpdateManager{
		observers:    make(map[tlf.ID]map[mdServerLocal]chan<- error),
		sessionHeads: make(map[tlf.ID]mdServerLocal),
	}
}

func (m *mdServerLocalUpdateManager) setHead(id tlf.ID, server mdServerLocal) {
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
	id tlf.ID, currHead, currMergedHeadRev kbfsmd.Revision,
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
		panic(errors.Errorf("Attempted double-registration for MDServerLocal %v",
			server))
	}
	m.observers[id][server] = c
	return c
}

func (m *mdServerLocalUpdateManager) cancel(id tlf.ID, server mdServerLocal) {
	m.lock.Lock()
	defer m.lock.Unlock()

	// Cancel the registration for this server only.
	for k, v := range m.observers[id] {
		if k == server {
			v <- errors.New("Registration canceled")
			close(v)
			delete(m.observers[id], k)
		}
	}
	if len(m.observers[id]) == 0 {
		delete(m.observers, id)
	}
}

type keyBundleGetter func(tlf.ID, TLFWriterKeyBundleID, TLFReaderKeyBundleID) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3, error)

func getExtraMetadata(kbg keyBundleGetter, brmd BareRootMetadata) (ExtraMetadata, error) {
	tlfID := brmd.TlfID()
	wkbID := brmd.GetTLFWriterKeyBundleID()
	rkbID := brmd.GetTLFReaderKeyBundleID()
	if (wkbID == TLFWriterKeyBundleID{}) !=
		(rkbID == TLFReaderKeyBundleID{}) {
		return nil, errors.Errorf(
			"wkbID is empty (%t) != rkbID is empty (%t)",
			wkbID == TLFWriterKeyBundleID{},
			rkbID == TLFReaderKeyBundleID{})
	}

	if wkbID == (TLFWriterKeyBundleID{}) {
		return nil, nil
	}

	wkb, rkb, err := kbg(tlfID, wkbID, rkbID)
	if err != nil {
		return nil, err
	}

	return NewExtraMetadataV3(*wkb, *rkb, false, false), nil
}
