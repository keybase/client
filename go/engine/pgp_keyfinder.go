package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// PGPKeyfinder is an engine to find PGP Keys for users (loaded by
// assertions), possibly tracking them if necessary.
type PGPKeyfinder struct {
	arg   *PGPKeyfinderArg
	uplus []*UserPlusKeys
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
	return EnginePrereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (e *PGPKeyfinder) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPKeyfinder) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewTrackEngine(nil),
		NewLuba(nil),
	}
}

// Run starts the engine.
func (e *PGPKeyfinder) Run(ctx *Context, args, reply interface{}) error {
	for _, u := range e.arg.Users {
		if err := e.loadUser(ctx, u); err != nil {
			return err
		}
	}

	// need to track any users we aren't tracking
	for _, x := range e.uplus {
		if x.IsTracked {
			continue
		}

		if err := e.trackUser(ctx, x.User); err != nil {
			return err
		}

		x.IsTracked = true
	}

	// get the pgp keys for all the users
	for _, x := range e.uplus {
		keys := x.User.GetActivePgpKeys(true)
		if len(keys) == 0 {
			return fmt.Errorf("User %s doesn't have a pgp key", x.User.GetName())
		}
		x.Keys = keys
	}

	return nil
}

// UsersPlusKeys returns the users found while running the engine,
// plus their pgp keys.
func (e *PGPKeyfinder) UsersPlusKeys() []*UserPlusKeys {
	return e.uplus
}

func (e *PGPKeyfinder) loadUser(ctx *Context, user string) error {
	arg := &LubaArg{
		Assertion:    user,
		WithTracking: true,
	}
	eng := NewLuba(arg)
	if err := RunEngine(eng, ctx, nil, nil); err != nil {
		return err
	}

	G.Log.Debug("loaded user %q => %q, %s", user, eng.User().GetName(), eng.User().GetUid())
	tracking, err := eng.IsTracking()
	if err != nil {
		return err
	}
	e.uplus = append(e.uplus, &UserPlusKeys{User: eng.User(), IsTracked: tracking})

	return nil
}

func (e *PGPKeyfinder) trackUser(ctx *Context, user *libkb.User) error {
	G.Log.Info("tracking user %q", user.GetName())
	arg := &TrackEngineArg{
		TheirName:    user.GetName(),
		Them:         user,
		TrackOptions: e.arg.TrackOptions,
	}
	eng := NewTrackEngine(arg)
	return RunEngine(eng, ctx, nil, nil)
}

type UserPlusKeys struct {
	User      *libkb.User
	IsTracked bool
	Keys      []*libkb.PgpKeyBundle
}
