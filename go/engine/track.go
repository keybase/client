// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	arg := &keybase1.Identify2Arg{
		UserAssertion:         e.arg.UserAssertion,
		ForceRemoteCheck:      e.arg.ForceRemoteCheck,
		NeedProofSet:          true,
		NoErrorOnTrackFailure: true,
		AlwaysBlock:           true,
	}

	ieng := NewResolveThenIdentify2WithTrack(e.G(), arg, e.arg.Options)
	if err := RunEngine(ieng, ctx); err != nil {
		return err
	}

	upk := ieng.Result().Upk
	var err error
	e.them, err = libkb.LoadUser(libkb.NewLoadUserByUIDArg(e.G(), upk.Uid))
	if err != nil {
		return err
	}

	confirmResult := ieng.ConfirmResult()
	if !confirmResult.IdentityConfirmed {
		e.G().Log.Debug("confirmResult: %+v", confirmResult)
		return errors.New("Track not confirmed")
	}

	// if they didn't specify local only on the command line, then if they answer no to posting
	// the tracking statement publicly to keybase, change LocalOnly to true here:
	if !e.arg.Options.LocalOnly && !confirmResult.RemoteConfirmed {
		e.arg.Options.LocalOnly = true
	}

	if !e.arg.Options.ExpiringLocal && confirmResult.ExpiringLocal {
		e.G().Log.Debug("-ExpiringLocal-")
		e.arg.Options.ExpiringLocal = true
	}

	targ := &TrackTokenArg{
		Token:   ieng.TrackToken(),
		Me:      e.arg.Me,
		Options: e.arg.Options,
	}
	teng := NewTrackToken(targ, e.G())
	return RunEngine(teng, ctx)
}

func (e *TrackEngine) User() *libkb.User {
	return e.them
}
