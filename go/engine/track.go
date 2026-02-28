// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type TrackEngineArg struct {
	UserAssertion    string
	Me               *libkb.User
	Options          keybase1.TrackOptions
	ForceRemoteCheck bool
	SigVersion       libkb.SigVersion
}

type TrackEngine struct {
	arg  *TrackEngineArg
	them *libkb.User
	libkb.Contextified
	confirmResult keybase1.ConfirmResult
}

// NewTrackEngine creates a default TrackEngine for tracking theirName.
func NewTrackEngine(g *libkb.GlobalContext, arg *TrackEngineArg) *TrackEngine {
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

func (e *TrackEngine) Run(m libkb.MetaContext) error {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "TrackEngine")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "TrackEngine")

	arg := &keybase1.Identify2Arg{
		UserAssertion:         e.arg.UserAssertion,
		ForceRemoteCheck:      e.arg.ForceRemoteCheck,
		NeedProofSet:          true,
		NoErrorOnTrackFailure: true,
		AlwaysBlock:           true,
	}

	if m.UIs().SessionID != 0 {
		arg.IdentifyBehavior = keybase1.TLFIdentifyBehavior_GUI
	} else {
		arg.IdentifyBehavior = keybase1.TLFIdentifyBehavior_CLI
	}

	ieng := NewResolveThenIdentify2WithTrack(m.G(), arg, e.arg.Options)
	if err := RunEngine2(m, ieng); err != nil {
		return err
	}

	res, err := ieng.Result(m)
	if err != nil {
		return err
	}
	upk := res.Upk

	if _, uid, _ := libkb.BootstrapActiveDeviceWithMetaContext(m); uid.Equal(upk.GetUID()) {
		return errors.New("You can't follow yourself.")
	}

	loadarg := libkb.NewLoadUserArgWithMetaContext(m).WithUID(upk.GetUID()).WithPublicKeyOptional()
	e.them, err = libkb.LoadUser(loadarg)
	if err != nil {
		return err
	}

	e.confirmResult = ieng.ConfirmResult()
	if !e.confirmResult.IdentityConfirmed {
		m.Debug("confirmResult: %+v", e.confirmResult)
		return errors.New("Follow not confirmed")
	}

	// if they didn't specify local only on the command line, then if they answer no to posting
	// the tracking statement publicly to keybase, change LocalOnly to true here:
	if !e.arg.Options.LocalOnly && !e.confirmResult.RemoteConfirmed {
		e.arg.Options.LocalOnly = true
	}

	if !e.arg.Options.ExpiringLocal && e.confirmResult.ExpiringLocal {
		m.Debug("-ExpiringLocal-")
		e.arg.Options.ExpiringLocal = true
	}

	targ := &TrackTokenArg{
		Token:   ieng.TrackToken(),
		Me:      e.arg.Me,
		Options: e.arg.Options,
	}
	teng := NewTrackToken(m.G(), targ)
	return RunEngine2(m, teng)
}

func (e *TrackEngine) User() *libkb.User {
	return e.them
}

func (e *TrackEngine) ConfirmResult() keybase1.ConfirmResult {
	return e.confirmResult
}
