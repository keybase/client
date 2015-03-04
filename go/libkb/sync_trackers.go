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

func (t Tracker) Eq(t2 Tracker) bool {
	return t.Tracker.Eq(t2.Tracker) && t.Status == t2.Status && t.Mtime == t2.Mtime
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
	dirty           bool
}

type TrackerSyncer struct {
	// Locks the wole object
	sync.RWMutex
	Contextified

	uid   *UID
	dirty bool

	trackers *TrackersLocal
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

func (t *TrackerSyncer) dbKey() DbKey {
	return DbKey{Typ: DB_TRACKERS, Key: t.uid.String()}
}

func (t *TrackersLocal) startingAfter() (ret int) {
	if len(t.Trackers) > 0 {
		ret = t.Trackers[len(t.Trackers)-1].Mtime - 1
	}
	return ret
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
	for _, el := range t.Trackers {
		if el != nil {
			index[el.Tracker] = len(list)
			list = append(list, el)
		} else {
			didCompact = true
			t.dirty = true
		}
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

func (t *TrackersServer) IsEmpty() bool {
	return len(t.Trackers) == 0
}

func (t *TrackersLocal) merge(s *TrackersServer) {
	t.Version = s.Version
	for _, el := range s.Trackers {
		if pos, found := t.index[el.Tracker]; found {
			if t.Trackers[pos].Eq(*el) {
				continue
			} else {
				t.Trackers[pos] = nil
				t.needsCompaction = true
			}
		}
		t.index[el.Tracker] = len(t.Trackers)
		t.Trackers = append(t.Trackers, el)
		t.dirty = true
	}
}

func (t *TrackerSyncer) importFromServer(lst *TrackersServer) (err error) {
	if t.trackers == nil {
		t.trackers = &TrackersLocal{}
		t.trackers.makeIndex()
	}
	t.trackers.merge(lst)
	return
}

func (t *TrackerSyncer) fetchBatch() (list *TrackersServer, err error) {
	hargs := HttpArgs{
		"uid":   S{t.uid.String()},
		"limit": I{100},
	}
	var tm int
	if t.trackers != nil {
		tm = t.trackers.startingAfter()
		if tm > 0 {
			hargs.Add("starting_after", I{tm})
		}
	}
	var res *ApiRes
	res, err = t.G().API.Get(ApiArg{
		Endpoint:    "user/trackers",
		Args:        hargs,
		NeedSession: false,
	})
	t.G().Log.Debug("| fetchBatch(%d) -> %s", tm, ErrToOk(err))
	if err != nil {
		return
	}
	var tmp TrackersServer
	if err = res.Body.UnmarshalAgain(&tmp); err != nil {
		return
	}
	list = &tmp
	t.G().Log.Debug("| server returned %d records", len(tmp.Trackers))
	return
}

func (t *TrackerSyncer) syncFromServer() (err error) {

	for {
		var lst *TrackersServer
		lst, err = t.fetchBatch()
		if err != nil || lst.IsEmpty() {
			break
		} else if err = t.importFromServer(lst); err != nil {
			break
		}
	}

	return
}
