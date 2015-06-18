package engine

import "github.com/keybase/client/go/libkb"

type TrackOptions struct {
	TrackLocalOnly bool // true: only track locally, false: track locally and remotely
	TrackApprove   bool // true: don't ask for confirmation, false: ask for confirmation
}

type TrackEngineArg struct {
	TheirName string
	Me        *libkb.User
	Options   TrackOptions
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
	iarg := NewIdentifyTrackArg(e.arg.TheirName, true, e.arg.Options)
	ieng := NewIdentify(iarg, e.G())
	if err := RunEngine(ieng, ctx); err != nil {
		e.G().Log.Info("identify run err: %s", err)
		return err
	}

	token := ieng.TrackToken()
	e.them = ieng.User()

	// prompt if the identify is correct
	tmp, err := ctx.IdentifyUI.FinishAndPrompt(ieng.Outcome().Export())
	if err != nil {
		return err
	}
	ti := libkb.ImportFinishAndPromptRes(tmp)
	if !ti.Local && !ti.Remote {
		e.G().Log.Debug("no tracking desired via ui")
		return nil
	}

	// now proceed to track with the token and the result of user interaction:
	if !ti.Remote {
		e.arg.Options.TrackLocalOnly = true
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
