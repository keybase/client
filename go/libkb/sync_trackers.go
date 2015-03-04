// A module for syncing trackers from the server
package libkb

import (
	"sync"
)

type Tracker struct {
	Tracker UID `json:"tracker"`
	Status  int `json:"status"`
	Mtime   int `json:"mtime"`
}

type TrackersServer struct {
	Version  int        `json:"version"`
	Trackers []*Tracker `json:"trackers"`
}

type TrackersLocal struct {
	Version  int        `json:"version"`
	Trackers []*Tracker `json:"trackers"`

	index           map[UID]int
	needsCompaction bool
}

type TrackerSyncer struct {
	// Locks the wole object
	sync.RWMutex
	Contextified

	uid   *UID
	dirty bool

	trackers *TrackersLocal
}

func mtimeLessThan(a, b interface{}) bool {
	return a.(int) < b.(int)
}

func NewTrackerSyncer(uid UID, g *GlobalContext) *TrackerSyncer {
	return &TrackerSyncer{
		Contextified: Contextified{g},
		uid:          &uid,
		dirty:        false,
	}
}

func (t *TrackerSyncer) dbKey() DbKey {
	return DbKey{Typ: DB_TRACKERS, Key: t.uid.String()}
}

func (t *TrackersLocal) makeIndex() {
	index := make(map[UID]int)
	for i, el := range t.Trackers {
		j, found := index[el.Tracker]
		if found {
			t.Trackers[j] = nil
			t.needsCompaction = true
		}
		index[el.Tracker] = i
	}
	t.index = index
}

func (t *TrackersLocal) compact() bool {
	if !t.needsCompaction {
		return false
	}
	list := make([]*Tracker, 0, len(t.Trackers))
	index := make(map[UID]int)
	didCompact := false
	for _, t := range t.Trackers {
		if t != nil {
			list = append(list, t)
		} else {
			didCompact = true
		}
		index[t.Tracker] = len(list)
	}
	t.index = index
	t.Trackers = list
	t.needsCompaction = false
	return didCompact
}

func (t *TrackerSyncer) loadFromStorage() (err error) {
	var tmp TrackersLocal
	var found bool
	found, err = t.G().LocalDb.GetInto(&tmp, t.dbKey())

	t.G().Log.Debug("| loadFromStorage -> found=%v, err=%s", found, ErrToOk(err))
	if found {
		t.G().Log.Debug("| Loaded version %d", tmp.Version)
	} else if err == nil {
		t.G().Log.Debug("| Loaded empty record set")
	}

	if err == nil {
		tmp.makeIndex()
		t.trackers = &tmp
	}
	return err
}

func (t *TrackerSyncer) store() (err error) {
	if t.trackers == nil {
		return
	}
	if t.trackers.compact() {
		t.dirty = true
	}

	if !t.dirty {
		return
	}

	if err = t.G().LocalDb.PutObj(t.dbKey(), nil, t.trackers); err != nil {
		return
	}
	t.dirty = false
	return
}
