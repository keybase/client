package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type TrackEngineArg struct {
	UserAssertion    string
	Me               *libkb.User
	Options          keybase1.TrackOptions
	ForceRemoteCheck bool
}

type TrackEngine struct {
	arg  *TrackEngineArg
	them *libkb.User
	libkb.Contextified
}

// NewTrackEngine creates a default TrackEngine for tracking theirName.
func NewTrackEngine(arg *TrackEngineArg, g *libkb.GlobalContext) *TrackEngine {
	return &TrackEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *TrackEngine) Name() string {
	return "Track"
}

func (e *TrackEngine) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

func (e *TrackEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
		libkb.IdentifyUIKind,
	}
}

func (e *TrackEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Identify{},
	}
}

func (e *TrackEngine) Run(ctx *Context) error {
	iarg := NewIdentifyTrackArg(e.arg.UserAssertion, true, e.arg.ForceRemoteCheck, e.arg.Options)
	ieng := NewIdentify(iarg, e.G())
	if err := RunEngine(ieng, ctx); err != nil {
		e.G().Log.Info("identify run err: %s", err)
		return err
	}

	token := ieng.TrackToken()
	e.them = ieng.User()

	// prompt if the identify is correct
	outcome := ieng.Outcome().Export()
	confirmed, err := ctx.IdentifyUI.Confirm(outcome)
	if err != nil {
		return err
	}
	if !confirmed {
		return fmt.Errorf("Track not confirmed")
	}

	targ := &TrackTokenArg{
		Token:   token,
		Me:      e.arg.Me,
		Options: e.arg.Options,
	}
	teng := NewTrackToken(targ, e.G())
	return RunEngine(teng, ctx)
}

func (e *TrackEngine) User() *libkb.User {
	return e.them
}
