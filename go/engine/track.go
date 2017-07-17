// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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
	confirmResult keybase1.ConfirmResult
}

// NewTrackEngine creates a default TrackEngine for tracking theirName.
func NewTrackEngine(arg *TrackEngineArg, g *libkb.GlobalContext) *TrackEngine {
	return &TrackEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *TrackEngine) Name() string {
	return "Follow"
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
		&ResolveThenIdentify2{},
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
	loadarg := libkb.NewLoadUserArgBase(e.G()).WithNetContext(ctx.NetContext).WithUID(upk.Uid).WithPublicKeyOptional()
	e.them, err = libkb.LoadUser(*loadarg)
	if err != nil {
		return err
	}

	e.confirmResult = ieng.ConfirmResult()
	if !e.confirmResult.IdentityConfirmed {
		e.G().Log.Debug("confirmResult: %+v", e.confirmResult)
		return errors.New("Follow not confirmed")
	}

	// if they didn't specify local only on the command line, then if they answer no to posting
	// the tracking statement publicly to keybase, change LocalOnly to true here:
	if !e.arg.Options.LocalOnly && !e.confirmResult.RemoteConfirmed {
		e.arg.Options.LocalOnly = true
	}

	if !e.arg.Options.ExpiringLocal && e.confirmResult.ExpiringLocal {
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

func (e *TrackEngine) ConfirmResult() keybase1.ConfirmResult {
	return e.confirmResult
}
