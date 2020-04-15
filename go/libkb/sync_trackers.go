// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type FollowDirection int

const (
	FollowDirectionFollowing FollowDirection = 0
	FollowDirectionFollowers FollowDirection = 1
)

func directionToReverse(direction FollowDirection) (reverse bool) {
	return direction == FollowDirectionFollowing
}

type ServertrustTrackerSyncer struct {
	sync.Mutex
	Contextified
	res       *keybase1.UserSummarySet
	direction FollowDirection
	dirty     bool
	callerUID keybase1.UID
}

const cacheTimeout = 10 * time.Minute

func (t *ServertrustTrackerSyncer) dbKey(u keybase1.UID) DbKey {
	if t.direction == FollowDirectionFollowing {
		return DbKeyUID(DBUnverifiedTrackersFollowing, u)
	}
	return DbKeyUID(DBUnverifiedTrackersFollowers, u)
}

func (t *ServertrustTrackerSyncer) loadFromStorage(m MetaContext, uid keybase1.UID, useExpiration bool) error {
	var err error
	var found bool
	var tmp keybase1.UserSummarySet
	defer m.Trace(fmt.Sprintf("loadFromStorage(%s)", uid), &err)()
	found, err = t.G().LocalDb.GetInto(&tmp, t.dbKey(uid))
	if err != nil {
		return err
	}
	if !found {
		m.Debug("| no cached copy found")
		return nil
	}
	cachedAt := keybase1.FromTime(tmp.Time)
	if useExpiration && time.Since(cachedAt) > cacheTimeout {
		m.Debug("| expired; cached at %s", cachedAt)
		return nil
	}
	m.Debug("| found a record, cached %s", cachedAt)
	t.res = &tmp
	return nil
}

func (t *ServertrustTrackerSyncer) getLoadedVersion() int {
	ret := -1
	if t.res != nil {
		ret = t.res.Version
	}
	return ret
}

func (t *ServertrustTrackerSyncer) syncFromServer(m MetaContext, uid keybase1.UID, forceReload bool) (err error) {

	defer m.Trace(fmt.Sprintf("syncFromServer(%s)", uid), &err)()

	hargs := HTTPArgs{
		"uid":        UIDArg(uid),
		"reverse":    B{directionToReverse(t.direction)},
		"autoCamel":  B{true},
		"caller_uid": UIDArg(t.callerUID),
	}
	lv := t.getLoadedVersion()
	if lv >= 0 && !forceReload {
		hargs.Add("version", I{lv})
	}
	var res *APIRes
	res, err = m.G().API.Get(m, APIArg{
		Endpoint: "user/list_followers_for_display",
		Args:     hargs,
	})
	m.Debug("| syncFromServer() -> %s", ErrToOk(err))
	if err != nil {
		return err
	}
	var tmp keybase1.UserSummarySet
	if err = res.Body.UnmarshalAgain(&tmp); err != nil {
		return
	}
	tmp.Time = keybase1.ToTime(time.Now())
	if lv < 0 || tmp.Version > lv || forceReload {
		m.Debug("| syncFromServer(): got update %d > %d (%d records)", tmp.Version, lv,
			len(tmp.Users))
		t.res = &tmp
		t.dirty = true
	} else {
		m.Debug("| syncFromServer(): no change needed @ %d", lv)
	}
	return nil
}

func (t *ServertrustTrackerSyncer) store(m MetaContext, uid keybase1.UID) error {
	var err error
	if !t.dirty {
		return err
	}

	if err = t.G().LocalDb.PutObj(t.dbKey(uid), nil, t.res); err != nil {
		return err
	}

	t.dirty = false
	return nil
}

func (t *ServertrustTrackerSyncer) needsLogin(m MetaContext) bool {
	return false
}

func (t *ServertrustTrackerSyncer) Block(m MetaContext, badUIDs map[keybase1.UID]bool) (err error) {
	defer m.Trace(fmt.Sprintf("ServertrustTrackerSyncer#Block(%+v)", badUIDs), &err)()
	t.Lock()
	defer t.Unlock()

	if t.direction != FollowDirectionFollowers {
		return fmt.Errorf("can only delete users out of followers cache")
	}

	if t.res == nil {
		m.Debug("No followers loaded, so nothing to do")
		return nil
	}

	err = t.loadFromStorage(m, t.callerUID, true)
	if err != nil {
		return err
	}

	var newUsers []keybase1.UserSummary
	for _, userSummary := range t.res.Users {
		if badUIDs[userSummary.Uid] {
			m.Debug("Filtering bad user out of state: %s", userSummary.Uid)
			t.dirty = true
		} else {
			newUsers = append(newUsers, userSummary)
		}
	}
	t.res.Users = newUsers
	err = t.store(m, t.callerUID)
	return err
}

func (t *ServertrustTrackerSyncer) Result() keybase1.UserSummarySet {
	if t.res == nil {
		return keybase1.UserSummarySet{}
	}

	// Normalize usernames
	var normalizedUsers []keybase1.UserSummary
	for _, u := range t.res.Users {
		normalizedUser := u
		normalizedUser.Username = NewNormalizedUsername(u.Username).String()
		normalizedUsers = append(normalizedUsers, normalizedUser)
	}
	t.res.Users = normalizedUsers

	return *t.res
}

func NewServertrustTrackerSyncer(g *GlobalContext, callerUID keybase1.UID, direction FollowDirection) *ServertrustTrackerSyncer {
	return &ServertrustTrackerSyncer{
		Contextified: NewContextified(g),
		direction:    direction,
		callerUID:    callerUID,
	}
}
