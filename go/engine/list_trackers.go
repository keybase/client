package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

// TrackerList is an engine to get a list of user's trackers
// (other users tracking this user).
type ListTrackersEngine struct {
	uid      *libkb.UID
	username string
	trackers *libkb.Trackers
	libkb.Contextified
}

// NewTrackerList creates a TrackerList engine for uid.
func NewListTrackers(uid *libkb.UID) *ListTrackersEngine {
	return &ListTrackersEngine{uid: uid}
}

// NewTrackerListUsername creates a TrackerList engine that will
// do a lookup by username.
func NewListTrackersByName(username string) *ListTrackersEngine {
	return &ListTrackersEngine{username: username}
}

// Name is the unique engine name.
func (e *ListTrackersEngine) Name() string {
	return "ListTrackersEngine"
}

// GetPrereqs returns the engine prereqs (none).
func (e *ListTrackersEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *ListTrackersEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *ListTrackersEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *ListTrackersEngine) Run(ctx *Context, args, reply interface{}) error {
	if err := e.ensureUID(); err != nil {
		return err
	}
	ts := libkb.NewTrackerSyncer(*e.uid, e.G())
	if err := libkb.RunSyncer(ts, e.uid); err != nil {
		return err
	}
	e.trackers = ts.Trackers()
	return nil
}

// List returns the array of trackers for this user.
func (e *ListTrackersEngine) List() []libkb.Tracker {
	if e.trackers == nil {
		return []libkb.Tracker{}
	}
	return e.trackers.Trackers
}

func (e *ListTrackersEngine) ExportedList() (ret []keybase_1.Tracker) {
	for _, el := range e.List() {
		ret = append(ret, el.Export())
	}
	return
}

func (e *ListTrackersEngine) ensureUID() error {
	if e.uid != nil {
		return nil
	}
	if len(e.username) == 0 {
		e.uid = e.G().GetMyUID()
		return nil
	}
	user, err := libkb.LoadUser(libkb.LoadUserArg{Name: e.username})
	if err != nil {
		return err
	}
	e.uid = user.GetUid().P()
	return nil
}
