// A module for syncing trackers from the server
package libkb

import (
	"sync"

	keybase_1 "github.com/keybase/client/protocol/go"
)

const (
	TrackStatusNone     = 0
	TrackStatusTracking = 1
)

type Tracker keybase_1.Tracker

func (t Tracker) GetUID() UID { return UID(t.Tracker) }

func (t Tracker) Eq(t2 Tracker) bool {
	return t.GetUID().Eq(t2.GetUID()) && t.Status == t2.Status && t.Mtime == t2.Mtime
}

type Trackers struct {
	Version  int       `json:"version"`
	Trackers []Tracker `json:"trackers"`
}

type TrackerSyncer struct {
	// Locks the wole object
	sync.RWMutex
	Contextified

	uid   *UID
	dirty bool

	trackers *Trackers
}

// Remove duplicates and "untrack" statements in the list
func (t Trackers) compact() (ret Trackers) {
	index := make(map[UID]int)

	ret.Version = t.Version
	ret.Trackers = make([]Tracker, 0, len(t.Trackers))

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

func (t *TrackerSyncer) getUID() *UID  { return t.uid }
func (t *TrackerSyncer) setUID(u *UID) { t.uid = u }

func NewTrackerSyncer(uid UID, g *GlobalContext) *TrackerSyncer {
	return &TrackerSyncer{
		Contextified: Contextified{g},
		uid:          &uid,
		dirty:        false,
	}
}

func (t *TrackerSyncer) Trackers() *Trackers {
	return t.trackers
}

func (t *TrackerSyncer) dbKey() DbKey {
	return DbKey{Typ: DB_TRACKERS, Key: t.uid.String()}
}

func (t *TrackerSyncer) loadFromStorage() (err error) {
	var found bool
	var tmp Trackers
	found, err = t.G().LocalDb.GetInto(&tmp, t.dbKey())

	t.G().Log.Debug("| loadFromStorage -> found=%v, err=%s", found, ErrToOk(err))
	if found {
		t.G().Log.Debug("| Loaded version %d", tmp.Version)
		t.trackers = &tmp
	} else if err == nil {
		t.G().Log.Debug("| Loaded empty record set")
	}

	return err
}

func (t *TrackerSyncer) store() (err error) {
	if !t.dirty {
		return
	}

	if err = t.G().LocalDb.PutObj(t.dbKey(), nil, t.trackers); err != nil {
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

func (t *TrackerSyncer) needsLogin() bool { return false }

func (t *TrackerSyncer) syncFromServer() (err error) {

	lv := t.getLoadedVersion()

	hargs := HttpArgs{
		"uid":   S{t.uid.String()},
		"limit": I{5000},
	}

	if lv >= 0 {
		hargs.Add("version", I{lv})
	}

	var res *ApiRes
	res, err = t.G().API.Get(ApiArg{
		Endpoint:    "user/trackers",
		Args:        hargs,
		NeedSession: false,
	})
	t.G().Log.Debug("| syncFromServer() -> %s", ErrToOk(err))
	if err != nil {
		return
	}
	var tmp Trackers
	if err = res.Body.UnmarshalAgain(&tmp); err != nil {
		return
	}
	if lv < 0 || tmp.Version > lv {
		t.G().Log.Debug("| syncFromServer(): got update %d > %d (%d records)", tmp.Version, lv,
			len(tmp.Trackers))
		tmp = tmp.compact()
		t.G().Log.Debug("| syncFromServer(): got update %d > %d (%d records)", tmp.Version, lv,
			len(tmp.Trackers))
		t.trackers = &tmp
		t.dirty = true
	} else {
		t.G().Log.Debug("| syncFromServer(): no change needed @ %d", lv)
	}

	return
}
