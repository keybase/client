package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// TrackerList is an engine to get a list of user's trackers
// (other users tracking this user).
type ListTrackersEngine struct {
	uid      keybase1.UID
	username string
	trackers *libkb.Trackers
	libkb.Contextified
}

// NewListTrackers creates a TrackerList engine for uid.
func NewListTrackers(uid keybase1.UID, g *libkb.GlobalContext) *ListTrackersEngine {
	return &ListTrackersEngine{
		uid:          uid,
		Contextified: libkb.NewContextified(g),
	}
}

// NewListTrackersByName creates a TrackerList engine that will
// do a lookup by username.
func NewListTrackersByName(username string) *ListTrackersEngine {
	return &ListTrackersEngine{username: username}
}

func NewListTrackersSelf() *ListTrackersEngine {
	return &ListTrackersEngine{}
}

// Name is the unique engine name.
func (e *ListTrackersEngine) Name() string {
	return "ListTrackersEngine"
}

// GetPrereqs returns the engine prereqs (none).
func (e *ListTrackersEngine) Prereqs() Prereqs {
	session := false
	if e.uid.IsNil() && len(e.username) == 0 {
		session = true
	}
	return Prereqs{Session: session}
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
func (e *ListTrackersEngine) Run(ctx *Context) error {
	if err := e.ensureUID(); err != nil {
		return err
	}
	ts := libkb.NewTrackerSyncer(e.uid, e.G())
	var err error
	aerr := e.G().LoginState().Account(func(a *libkb.Account) {
		err = libkb.RunSyncer(ts, e.uid, a.LoggedIn(), a.LocalSession())
	}, "ListTrackersEngine - Run")
	if aerr != nil {
		return aerr
	}
	if err != nil {
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

func (e *ListTrackersEngine) ExportedList() (ret []keybase1.Tracker) {
	for _, el := range e.List() {
		ret = append(ret, el.Export())
	}
	return
}

func (e *ListTrackersEngine) ensureUID() error {
	if e.uid.Exists() {
		return nil
	}
	if len(e.username) == 0 {
		e.uid = e.G().GetMyUID()
		return nil
	}
	user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(e.G(), e.username))
	if err != nil {
		return err
	}
	e.uid = user.GetUID()
	return nil
}
