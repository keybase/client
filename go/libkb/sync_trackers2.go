// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type Tracker2Syncer struct {
	sync.Mutex
	Contextified
	res     *keybase1.UserSummary2Set
	reverse bool
	dirty   bool
}

const cacheTimeout = 10 * time.Minute

func (t *Tracker2Syncer) dbKey(u keybase1.UID) DbKey {
	if t.reverse {
		return DbKeyUID(DBTrackers2Reverse, u)
	}
	return DbKeyUID(DBTrackers2, u)
}

func (t *Tracker2Syncer) loadFromStorage(uid keybase1.UID) error {
	var err error
	var found bool
	var tmp keybase1.UserSummary2Set
	defer t.G().Trace(fmt.Sprintf("loadFromStorage(%s)", uid), func() error { return err })()
	found, err = t.G().LocalDb.GetInto(&tmp, t.dbKey(uid))
	if err != nil {
		return err
	}
	if !found {
		t.G().Log.Debug("| no cached copy found")
		return nil
	}
	cachedAt := keybase1.FromTime(tmp.Time)
	if time.Now().Sub(cachedAt) > cacheTimeout {
		t.G().Log.Debug("| expired; cached at %s", cachedAt)
		return nil
	}
	t.G().Log.Debug("| found a record, cached %s", cachedAt)
	t.res = &tmp
	return nil
}

func (t *Tracker2Syncer) getLoadedVersion() int {
	ret := -1
	if t.res != nil {
		ret = t.res.Version
	}
	return ret
}

func (t *Tracker2Syncer) syncFromServer(uid keybase1.UID, sr SessionReader) (err error) {

	defer t.G().Trace(fmt.Sprintf("syncFromServer(%s)", uid), func() error { return err })()

	hargs := HTTPArgs{
		"uid":       UIDArg(uid),
		"reverse":   B{t.reverse},
		"autoCamel": B{true},
	}
	lv := t.getLoadedVersion()
	if lv >= 0 {
		hargs.Add("version", I{lv})
	}
	var res *APIRes
	res, err = t.G().API.Get(APIArg{
		Endpoint:    "user/list_followers_for_display",
		Args:        hargs,
		SessionR:    sr,
		NeedSession: true,
	})
	t.G().Log.Debug("| syncFromServer() -> %s", ErrToOk(err))
	if err != nil {
		return err
	}
	var tmp keybase1.UserSummary2Set
	if err = res.Body.UnmarshalAgain(&tmp); err != nil {
		return
	}
	tmp.Time = keybase1.ToTime(time.Now())
	if lv < 0 || tmp.Version > lv {
		t.G().Log.Debug("| syncFromServer(): got update %d > %d (%d records)", tmp.Version, lv,
			len(tmp.Users))
		t.res = &tmp
		t.dirty = true
	} else {
		t.G().Log.Debug("| syncFromServer(): no change needed @ %d", lv)
	}
	return nil
}

func (t *Tracker2Syncer) store(uid keybase1.UID) error {
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

func (t *Tracker2Syncer) needsLogin() bool {
	return false
}

func (t *Tracker2Syncer) Result() keybase1.UserSummary2Set {
	if t.res == nil {
		return keybase1.UserSummary2Set{}
	}
	return *t.res
}

func NewTracker2Syncer(g *GlobalContext, reverse bool) *Tracker2Syncer {
	return &Tracker2Syncer{
		Contextified: NewContextified(g),
		reverse:      reverse,
	}
}
