// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type SaltpackSenderIdentifyArg struct {
	publicKey        keybase1.KID
	isAnon           bool
	interactive      bool
	forceRemoteCheck bool
	reason           keybase1.IdentifyReason
	userAssertion    string // optional
}

type SaltpackSenderIdentify struct {
	libkb.Contextified
	arg *SaltpackSenderIdentifyArg
	res keybase1.SaltpackSender
}

func (e *SaltpackSenderIdentify) Name() string {
	return "SaltpackSenderIdentify"
}

func NewSaltpackSenderIdentify(g *libkb.GlobalContext, arg *SaltpackSenderIdentifyArg) *SaltpackSenderIdentify {
	return &SaltpackSenderIdentify{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// GetPrereqs returns the engine prereqs.
func (e *SaltpackSenderIdentify) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltpackSenderIdentify) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltpackSenderIdentify) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Identify2WithUID{},
	}
}

func (e *SaltpackSenderIdentify) Run(ctx *Context) error {
	defer e.G().Trace("SaltpackSenderIdentify::Run", func() error { return err })()

	if e.arg.isAnon {
		e.res.SenderType = keybase1.SaltpackSenderType_ANONYMOUS
		return
	}

	_, maybeUID, err := libkb.KeyLookupKIDIncludingRevoked(e.G(), e.arg.publicKey)
	if _, ok := err.(libkb.NotFoundError); ok {
		e.res.SenderType = keybase1.SaltpackSenderType_UNKNOWN
	} else if err != nil {
		return err
	}

	e.res.Uid, err = e.confirmKeyOwnership(e.G(), maybeUID)
	if err != nil {
		return err
	}

	if err = e.identifySender(ctx); err != nil {
		return err
	}

	return nil
}

func (e *SaltpackSenderIdentify) confirmKeyOwnership(ctx *Context, maybeUID keybase1.UID) error {
	loadUserArg := NewLoadUserByUIDArg(maybeUID)
	user, err := LoadUser(loadUserArg)
	if err != nil {
		return err
	}
}

func (e *SaltpackSenderIdentify) identifySender(ctx *Context) (err error) {
	defer e.G().Trace("SaltpackDecrypt::identifySender", func() error { return err })()

	var lin bool
	var uid keybase1.UID
	if lin, uid, err = IsLoggedIn(e, ctx); err == nil && lin && uid.Equal(e.res.Uid) {
		e.res.SenderType = keybase1.SaltpackSenderType_SELF
		if len(e.arg.userAssertion) == 0 {
			e.G().Log.Debug("| Sender is self")
			return nil
		}
	}

	iarg := keybase1.Identify2Arg{
		Uid:                   e.res.Uid,
		UseDelegateUI:         !e.arg.interactive,
		AlwaysBlock:           e.arg.interactive,
		ForceRemoteCheck:      e.arg.forceRemoteCheck,
		NeedProofSet:          true,
		NoErrorOnTrackFailure: true,
		Reason:                e.arg.reason,
		UserAssertion:         e.arg.userAssertion,
	}
	eng := NewIdentify2WithUID(e.G(), &iarg)
	if err = RunEngine(eng, ctx); err != nil {
		return err
	}

	if e.res.SenderType == keybase1.SaltpackSenderType_SELF {
		// if we already know the sender type, then return now
		return nil
	}

	switch eng.getTrackType() {
	case identify2NoTrack:
		e.res.SenderType = keybase1.SaltpackSenderType_NOT_TRACKED
	case identify2TrackOK:
		e.res.SenderType = keybase1.SaltpackSenderType_TRACKING_OK
	default:
		e.res.SenderType = keybase1.SaltpackSenderType_TRACKING_BROKE
	}
	return nil
}

func (e *SaltpackSenderIdentify) Result() keybase1.SaltpackSender {
	return e.res
}
