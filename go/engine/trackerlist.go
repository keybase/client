package engine

import (
	"github.com/keybase/client/go/libkb"
)

// TrackerList is an engine to get a list of user's trackers
// (other users tracking this user).
type TrackerList struct {
	uid      libkb.UID
	trackers *libkb.Trackers
	libkb.Contextified
}

// NewTrackerList creates a TrackerList engine for uid.
func NewTrackerList(uid libkb.UID) *TrackerList {
	return &TrackerList{uid: uid}
}

// Name is the unique engine name.
func (e *TrackerList) Name() string {
	return "TrackerList"
}

// GetPrereqs returns the engine prereqs (none).
func (e *TrackerList) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *TrackerList) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *TrackerList) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *TrackerList) Run(ctx *Context, args, reply interface{}) error {
	ts := libkb.NewTrackerSyncer(e.uid, e.G())
	if err := libkb.RunSyncer(ts, &e.uid); err != nil {
		return err
	}
	e.trackers = ts.Trackers()
	return nil
}

// List returns the array of trackers for this user.
func (e *TrackerList) List() []libkb.Tracker {
	if e.trackers == nil {
		return []libkb.Tracker{}
	}
	return e.trackers.Trackers
}
