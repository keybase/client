package libkb

import (
	"fmt"
)

type Locker interface {
	Lock()
	Unlock()
}

type Syncer interface {
	Contexitifier
	Locker
	loadFromStorage() error
	syncFromServer() error
	store() error
	getUID() *UID
	setUID(u *UID)
	needsLogin() bool
}

func RunSyncer(s Syncer, aUid *UID) (err error) {
	s.Lock()
	defer s.Unlock()

	var uid UID

	sUid := s.getUID()

	// If no UID was passed, and if no UID is local to the syncer, we still
	// can pull one from the environment (assuming my UID).  If that fails,
	// we have nothing to do.
	if sUid == nil && aUid == nil {
		if aUid = s.G().GetMyUID(); aUid == nil {
			err = NotFoundError{"No UID given to syncer"}
			return
		}
	}

	if sUid != nil && aUid != nil && !sUid.Eq(*aUid) {
		err = UidMismatchError{fmt.Sprintf("UID clash in Syncer: %s != %s", *sUid, *aUid)}
		return
	} else if aUid != nil {
		uid = *aUid
		s.setUID(aUid)
	} else {
		uid = *sUid
	}

	uid_s := uid.String()

	s.G().Log.Debug("+ Syncer.Load(%s)", uid_s)
	defer func() {
		s.G().Log.Debug("- Syncer.Load(%s) -> %s", uid_s, ErrToOk(err))
	}()

	if err = s.loadFromStorage(); err != nil {
		return
	}
	if !s.G().LoginState.Session().IsLoggedIn() && s.needsLogin() {
		s.G().Log.Debug("| Won't sync with server since we're not logged in")
		return
	}
	if err = s.syncFromServer(); err != nil {
		return
	}
	if err = s.store(); err != nil {
		return
	}

	return
}
