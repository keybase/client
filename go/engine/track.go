// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type TrackEngineArg struct {
	UserAssertion     string
	Me                *libkb.User
	Options           keybase1.TrackOptions
	ForceRemoteCheck  bool
	AllowSelfIdentify bool
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
		Device: true,
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
	iarg.AllowSelf = e.arg.AllowSelfIdentify
	iarg.Reason.Type = keybase1.IdentifyReasonType_TRACK
	ieng := NewIdentify(iarg, e.G())
	if err := RunEngine(ieng, ctx); err != nil {
		e.G().Log.Debug("RunEngine(NewIdentify) error: %v", err)
		return err
	}

	token := ieng.TrackToken()
	e.them = ieng.User()

	// prompt if the identify is correct
	outcome := ieng.Outcome().Export()
	result, err := ctx.IdentifyUI.Confirm(outcome)
	if err != nil {
		e.G().Log.Debug("IdentifyUI.Confirm error: %v", err)
		return err
	}
	if !result.IdentityConfirmed {
		return errors.New("Track not confirmed")
	}

	// if they didn't specify local only on the command line, then if they answer no to posting
	// the tracking statement publicly to keybase, change LocalOnly to true here:
	if !e.arg.Options.LocalOnly && !result.RemoteConfirmed {
		e.arg.Options.LocalOnly = true
	}

	if !e.arg.Options.ExpiringLocal && result.ExpiringLocal {
		e.G().Log.Debug("-ExpiringLocal-")
		e.arg.Options.ExpiringLocal = true
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
