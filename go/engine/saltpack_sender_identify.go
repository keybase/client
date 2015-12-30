// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type SaltPackSenderIdentifyArg struct {
	publicKey        keybase1.KID
	isAnon           bool
	interactive      bool
	forceRemoteCheck bool
	reason           keybase1.IdentifyReason
}

type SaltPackSenderIdentify struct {
	libkb.Contextified
	arg *SaltPackSenderIdentifyArg
	res keybase1.SaltPackSender
}

func (e *SaltPackSenderIdentify) Name() string {
	return "SaltPackSenderIdentify"
}

func NewSaltPackSenderIdentify(g *libkb.GlobalContext, arg *SaltPackSenderIdentifyArg) *SaltPackSenderIdentify {
	return &SaltPackSenderIdentify{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// GetPrereqs returns the engine prereqs.
func (e *SaltPackSenderIdentify) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltPackSenderIdentify) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackSenderIdentify) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Identify2WithUID{},
	}
}

func (e *SaltPackSenderIdentify) Run(ctx *Context) (err error) {
	defer e.G().Trace("SaltPackSenderIdentify::Run", func() error { return err })()

	if e.arg.isAnon {
		e.res.SenderType = keybase1.SaltPackSenderType_ANONYMOUS
		return
	}

	if err = e.lookupSender(); err != nil {
		if _, ok := err.(libkb.NotFoundError); ok {
			e.res.SenderType = keybase1.SaltPackSenderType_UNKNOWN
			err = nil
		}
		return err
	}

	if err = e.identifySender(ctx); err != nil {
		return err
	}

	return nil
}

func (e *SaltPackSenderIdentify) lookupSender() (err error) {
	defer e.G().Trace("SaltPackDecrypt::lookupSender", func() error { return err })()
	e.res.Username, e.res.Uid, err = libkb.KeyLookupKID(e.G(), e.arg.publicKey)
	return err
}

func (e *SaltPackSenderIdentify) identifySender(ctx *Context) (err error) {
	defer e.G().Trace("SaltPackDecrypt::identifySender", func() error { return err })()
	iarg := keybase1.Identify2Arg{
		Uid:                   e.res.Uid,
		UseDelegateUI:         !e.arg.interactive,
		AlwaysBlock:           e.arg.interactive,
		ForceRemoteCheck:      e.arg.forceRemoteCheck,
		NoErrorOnTrackFailure: true,
		Reason:                e.arg.reason,
	}
	eng := NewIdentify2WithUID(e.G(), &iarg)
	if err = RunEngine(eng, ctx); err != nil {
		return err
	}
	switch eng.getTrackType() {
	case identify2NoTrack:
		e.res.SenderType = keybase1.SaltPackSenderType_NOT_TRACKED
	case identify2TrackOK:
		e.res.SenderType = keybase1.SaltPackSenderType_TRACKING_OK
	default:
		e.res.SenderType = keybase1.SaltPackSenderType_TRACKING_BROKE
	}
	return nil
}

func (e *SaltPackSenderIdentify) Result() keybase1.SaltPackSender {
	return e.res
}
