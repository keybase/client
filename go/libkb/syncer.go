package libkb

import (
	"fmt"
	"sync"
)

type Syncer interface {
	Contexitifier
	sync.Locker
	loadFromStorage() error
	syncFromServer(SessionReader) error
	store() error
	getUID() UID
	setUID(u UID)
	needsLogin() bool
}

func RunSyncer(s Syncer, aUid UID, loggedIn bool, sr SessionReader) (err error) {
	s.Lock()
	defer s.Unlock()

	var uid UID

	sUid := s.getUID()

	// If no UID was passed, and if no UID is local to the syncer, we still
	// can pull one from the environment (assuming my UID).  If that fails,
	// we have nothing to do.
	if len(sUid) == 0 && len(aUid) == 0 {
		if aUid = s.G().GetMyUID(); len(aUid) == 0 {
			err = NotFoundError{"No UID given to syncer"}
			return
		}
		err = NotFoundError{"No UID given to syncer"}
		return
	}

	if len(sUid) > 0 && len(aUid) > 0 && sUid != aUid {
		err = UidMismatchError{fmt.Sprintf("UID clash in Syncer: %s != %s", sUid, aUid)}
		return
	} else if len(aUid) > 0 {
		uid = aUid
		s.setUID(aUid)
	} else {
		uid = sUid
	}

	s.G().Log.Debug("+ Syncer.Load(%s)", uid)
	defer func() {
		s.G().Log.Debug("- Syncer.Load(%s) -> %s", uid, ErrToOk(err))
	}()

	if err = s.loadFromStorage(); err != nil {
		return
	}
	if s.needsLogin() && !loggedIn {
		s.G().Log.Debug("| Won't sync with server since we're not logged in")
		return
	}
	if err = s.syncFromServer(sr); err != nil {
		return
	}
	if err = s.store(); err != nil {
		return
	}

	return
}
