// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type Syncer interface {
	Contextifier
	sync.Locker
	loadFromStorage(m MetaContext, u keybase1.UID, useExpiration bool) error
	syncFromServer(m MetaContext, u keybase1.UID, forceReload bool) error
	store(m MetaContext, u keybase1.UID) error
	needsLogin(m MetaContext) bool
}

func RunSyncer(m MetaContext, s Syncer, uid keybase1.UID, loggedIn bool, forceReload bool) (err error) {
	if uid.IsNil() {
		return NotFoundError{"No UID given to syncer"}
	}

	// unnecessary for secret syncer, but possibly useful for tracker syncer.
	s.Lock()
	defer s.Unlock()

	defer m.Trace(fmt.Sprintf("RunSyncer(%s)", uid), func() error { return err })()

	if err = s.loadFromStorage(m, uid, true); err != nil {
		return
	}

	if m.G().ConnectivityMonitor.IsConnected(context.Background()) == ConnectivityMonitorNo {
		m.Debug("| not connected, won't sync with server")
		return
	}

	if s.needsLogin(m) && !loggedIn {
		m.Debug("| Won't sync with server since we're not logged in")
		return
	}
	if err = s.syncFromServer(m, uid, forceReload); err != nil {
		return
	}
	if err = s.store(m, uid); err != nil {
		return
	}

	return
}

func RunSyncerCached(m MetaContext, s Syncer, uid keybase1.UID) (err error) {
	if uid.IsNil() {
		return NotFoundError{"No UID given to syncer"}
	}

	// unnecessary for secret syncer, but possibly useful for tracker syncer.
	s.Lock()
	defer s.Unlock()

	defer m.Trace(fmt.Sprintf("RunSyncerCached(%s)", uid), func() error { return err })()

	return s.loadFromStorage(m, uid, false)
}
