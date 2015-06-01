package libkb

import (
	"sync"

	keybase1 "github.com/keybase/client/protocol/go"
)

type Syncer interface {
	Contexitifier
	sync.Locker
	loadFromStorage(keybase1.UID) error
	syncFromServer(keybase1.UID, SessionReader) error
	store(keybase1.UID) error
	needsLogin() bool
}

func RunSyncer(s Syncer, uid keybase1.UID, loggedIn bool, sr SessionReader) (err error) {
	if uid.IsNil() {
		return NotFoundError{"No UID given to syncer"}
	}

	// unnecessary for secret syncer, but possibly useful for tracker syncer.
	s.Lock()
	defer s.Unlock()

	s.G().Log.Debug("+ Syncer.Load(%s)", uid)
	defer func() {
		s.G().Log.Debug("- Syncer.Load(%s) -> %s", uid, ErrToOk(err))
	}()

	if err = s.loadFromStorage(uid); err != nil {
		return
	}
	if s.needsLogin() && !loggedIn {
		s.G().Log.Debug("| Won't sync with server since we're not logged in")
		return
	}
	if err = s.syncFromServer(uid, sr); err != nil {
		return
	}
	if err = s.store(uid); err != nil {
		return
	}

	return
}
