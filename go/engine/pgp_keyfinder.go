package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PGPKeyfinder is an engine to find PGP Keys for users (loaded by
// assertions), possibly tracking them if necessary.
type PGPKeyfinder struct {
	users []string
}

// NewPGPKeyfinder creates a PGPKeyfinder engine.
func NewPGPKeyfinder(users []string) *PGPKeyfinder {
	return &PGPKeyfinder{users: users}
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
	return []libkb.UIKind{libkb.IdentifyUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPKeyfinder) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *PGPKeyfinder) Run(ctx *Context, args, reply interface{}) error {
	for _, u := range e.users {
		if err := e.loadUser(ctx, u); err != nil {
			return err
		}
	}
	return nil
}

func (e *PGPKeyfinder) loadUser(ctx *Context, user string) error {
	res := libkb.LoadUserByAssertions(user, true, ctx.IdentifyUI)
	if res.Error != nil {
		return res.Error
	}

	// XXX store user in engine
	G.Log.Info("loaded user %q => %q, %s", user, res.User.GetName(), res.User.GetUid())
	if res.IdentifyRes != nil {
		G.Log.Info("TrackUsed: %+v", res.IdentifyRes.TrackUsed)
		G.Log.Info("IdentifyRes: %+v", res.IdentifyRes)
	} else {
		G.Log.Info("IdentifyRes is nil")
	}

	return nil
}
