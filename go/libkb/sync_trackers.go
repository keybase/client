// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// A module for syncing trackers from the server
package libkb

import (
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	TrackStatusNone     = 0
	TrackStatusTracking = 1
)

type Tracker keybase1.Tracker

func (t Tracker) GetUID() keybase1.UID { return keybase1.UID(t.Tracker) }

func (t Tracker) Eq(t2 Tracker) bool {
	return t.GetUID().Equal(t2.GetUID()) && t.Status == t2.Status && t.MTime == t2.MTime
}

type Trackers struct {
	Version  int       `json:"version"`
	Trackers []Tracker `json:"trackers"`
}

type TrackerSyncer struct {
	// Locks the whole object
	sync.RWMutex
	Contextified

	dirty bool

	trackers *Trackers
}

// Remove duplicates and "untrack" statements in the list
func (t Trackers) compact() (ret Trackers) {
	index := make(map[keybase1.UID]int)

	ret.Version = t.Version

	for _, el := range t.Trackers {
		if _, found := index[el.GetUID()]; !found {
			index[el.GetUID()] = el.Status
			if el.Status == TrackStatusTracking {
				ret.Trackers = append(ret.Trackers, el)
			}
		}
	}
	return ret
}

func NewTrackerSyncer(uid keybase1.UID, g *GlobalContext) *TrackerSyncer {
	return &TrackerSyncer{
		Contextified: Contextified{g},
		dirty:        false,
	}
}

func (t *TrackerSyncer) Trackers() *Trackers {
	return t.trackers
}

func (t *TrackerSyncer) dbKey(uid keybase1.UID) DbKey {
	return DbKeyUID(DBTrackers, uid)
}

func (t *TrackerSyncer) loadFromStorage(m MetaContext, uid keybase1.UID) (err error) {
	var found bool
	var tmp Trackers
	found, err = t.G().LocalDb.GetInto(&tmp, t.dbKey(uid))

	m.CDebugf("| loadFromStorage -> found=%v, err=%s", found, ErrToOk(err))
	if found {
		m.CDebugf("| Loaded version %d", tmp.Version)
		t.trackers = &tmp
	} else if err == nil {
		m.CDebugf("| Loaded empty record set")
	}

	return err
}

func (t *TrackerSyncer) store(m MetaContext, uid keybase1.UID) (err error) {
	if !t.dirty {
		return
	}

	if err = t.G().LocalDb.PutObj(t.dbKey(uid), nil, t.trackers); err != nil {
		return
	}

	t.dirty = false
	return
}

func (t *TrackerSyncer) getLoadedVersion() int {
	ret := -1
	if t.trackers != nil {
		ret = t.trackers.Version
	}
	return ret
}

func (t *TrackerSyncer) needsLogin(m MetaContext) bool { return false }

func (t *TrackerSyncer) syncFromServer(m MetaContext, uid keybase1.UID, forceReload bool) (err error) {

	lv := t.getLoadedVersion()

	hargs := HTTPArgs{
		"uid":   UIDArg(uid),
		"limit": I{5000},
	}

	if lv >= 0 && !forceReload {
		hargs.Add("version", I{lv})
	}

	var res *APIRes
	res, err = m.G().API.Get(m, APIArg{
		Endpoint:    "user/trackers",
		Args:        hargs,
		SessionType: APISessionTypeNONE,
	})
	m.CDebugf("| syncFromServer() -> %s", ErrToOk(err))
	if err != nil {
		return err
	}
	var tmp Trackers
	if err = res.Body.UnmarshalAgain(&tmp); err != nil {
		return err
	}
	if lv < 0 || tmp.Version > lv || forceReload {
		m.CDebugf("| syncFromServer(): got update %d > %d (%d records)", tmp.Version, lv,
			len(tmp.Trackers))
		tmp = tmp.compact()
		m.CDebugf("| syncFromServer(): got update %d > %d (%d records)", tmp.Version, lv,
			len(tmp.Trackers))
		t.trackers = &tmp
		t.dirty = true
	} else {
		m.CDebugf("| syncFromServer(): no change needed @ %d", lv)
	}
	return err
}
