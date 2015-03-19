package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// PGPKeyfinder is an engine to find PGP Keys for users (loaded by
// assertions), possibly tracking them if necessary.
type PGPKeyfinder struct {
	arg      *PGPKeyfinderArg
	uplus    []*UserPlusKeys
	loggedIn bool
	me       *libkb.User
	runerr   error
}

type PGPKeyfinderArg struct {
	Users []string
	TrackOptions
}

// NewPGPKeyfinder creates a PGPKeyfinder engine.
func NewPGPKeyfinder(arg *PGPKeyfinderArg) *PGPKeyfinder {
	return &PGPKeyfinder{arg: arg}
}

// Name is the unique engine name.
func (e *PGPKeyfinder) Name() string {
	return "PGPKeyfinder"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPKeyfinder) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPKeyfinder) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPKeyfinder) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewTrackEngine(nil),
		NewIdentify(nil),
	}
}

// Run starts the engine.
func (e *PGPKeyfinder) Run(ctx *Context) error {
	e.setup()
	e.verifyUsers(ctx)
	e.loadKeys(ctx)
	return e.runerr
}

// UsersPlusKeys returns the users found while running the engine,
// plus their pgp keys.
func (e *PGPKeyfinder) UsersPlusKeys() []*UserPlusKeys {
	return e.uplus
}

func (e *PGPKeyfinder) setup() {
	if e.runerr != nil {
		return
	}

	ok, err := IsLoggedIn()
	if err != nil {
		e.runerr = err
		return
	}
	e.loggedIn = ok
}

func (e *PGPKeyfinder) verifyUsers(ctx *Context) {
	if e.runerr != nil {
		return
	}

	if e.loggedIn {
		e.loadMe()
		e.trackUsers(ctx)
	} else {
		e.identifyUsers(ctx)
	}
}

func (e *PGPKeyfinder) trackUsers(ctx *Context) {
	if e.runerr != nil {
		return
	}

	// need to track any users we aren't tracking
	for _, u := range e.arg.Users {
		if err := e.trackUser(ctx, u); err != nil {
			e.runerr = err
			return
		}
	}
}

func (e *PGPKeyfinder) identifyUsers(ctx *Context) {
	if e.runerr != nil {
		return
	}

	// need to identify all the users
	for _, u := range e.arg.Users {
		if err := e.identifyUser(ctx, u); err != nil {
			e.runerr = err
			return
		}
	}
}

func (e *PGPKeyfinder) loadKeys(ctx *Context) {
	if e.runerr != nil {
		return
	}

	// get the pgp keys for all the users
	for _, x := range e.uplus {
		keys := x.User.GetActivePgpKeys(true)
		if len(keys) == 0 {
			e.runerr = fmt.Errorf("User %s doesn't have a pgp key", x.User.GetName())
			return
		}
		x.Keys = keys
	}
}

func (e *PGPKeyfinder) trackUser(ctx *Context, user string) error {
	G.Log.Info("tracking user %q", user)
	arg := &TrackEngineArg{
		Me:        e.me,
		TheirName: user,
		Options:   e.arg.TrackOptions,
	}
	eng := NewTrackEngine(arg)
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}
	e.addUser(eng.User(), true)
	return nil
}

// PC: maybe we need to bring the TrackUI back for the
// context...so that this one can use an IdentifyUI and trackUser
// can use a TrackUI...
func (e *PGPKeyfinder) identifyUser(ctx *Context, user string) error {
	arg := NewIdentifyArg(user, false)
	eng := NewIdentify(arg)
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}
	e.addUser(eng.User(), false)
	return nil
}

type UserPlusKeys struct {
	User      *libkb.User
	IsTracked bool
	Keys      []*libkb.PgpKeyBundle
}

func (e *PGPKeyfinder) loadMe() error {
	if e.me != nil {
		return nil
	}
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	e.me = me
	return nil
}

func (e *PGPKeyfinder) addUser(user *libkb.User, tracked bool) {
	e.uplus = append(e.uplus, &UserPlusKeys{User: user, IsTracked: tracked})
}
