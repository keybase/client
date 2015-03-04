// A module for syncing trackers from the server
package libkb

import (
	"github.com/stathat/treap"
	"sync"
)

type Tracker struct {
	Tracker UID `json:"tracker"`
	Status  int `json:"status"`
	Mtime   int `json:"mtime"`
}

type Trackers struct {
	Version  int       `json:"version"`
	Trackers []Tracker `json:"trackers"`
}

type TrackerSyncer struct {
	// Locks the wole object
	sync.RWMutex
	Contextified

	uid   UID
	dirty bool

	trackerOrder *treap.Tree      // Map of ctime -> UID
	trackers     map[UID]*Tracker // Map of UID -> Tracker
}

func mtimeLessThan(a, b interface{}) bool {
	return a.(int) < b.(int)
}

func NewTrackerSyncer(uid UID, g *GlobalContext) *TrackerSyncer {
	return &TrackerSyncer{
		Contextified: Contextified{g},
		uid:          uid,
		dirty:        false,
		trackerOrder: treap.NewTree(mtimeLessThan),
		trackers:     make(map[UID]*Tracker),
	}
}

func (t *TrackerSyncer) Load(uid UID) (err error) {

	t.Lock()
	defer t.Unlock()

	uid_s := t.uid.String()

	t.G().Log.Debug("+ TrackerSyncer.Load(%s)", uid_s)
	defer func() {
		t.G().Log.Debug("- TrackerSyncer.Load(%s) -> %s", uid_s, ErrToOk(err))
	}()

	return
}
