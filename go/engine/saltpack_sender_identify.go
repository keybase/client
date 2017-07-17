// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

func (e *SaltpackSenderIdentify) Run(ctx *Context) (err error) {
	defer e.G().Trace("SaltpackSenderIdentify::Run", func() error { return err })()

	if e.arg.isAnon {
		e.res.SenderType = keybase1.SaltpackSenderType_ANONYMOUS
		return
	}

	// Essentially nothing that this key/basics.json endpoint tells us is
	// verifiable. Don't even retain the username it gives us here; we'll get
	// it from LoadUser instead, where we check some of the server's work.
	//
	// Security note: This is an opportunity for the server to maliciously DOS
	// us, by lying and saying a key doesn't exist. If we wanted to really
	// prevent this, we could include a KID->UID index in the Merkle tree that
	// we pin against the bitcoin blockchain, and trust that Someone Out There
	// would audit it for consistency with the main body of the tree. File this
	// one away in the Book of Things We Would Do With Infinite Time and Money.
	var maybeUID keybase1.UID
	_, maybeUID, err = libkb.KeyLookupKIDIncludingRevoked(e.G(), e.arg.publicKey)
	if _, ok := err.(libkb.NotFoundError); ok {
		// The key in question might not be a Keybase key at all (for example,
		// anything generated with the Python saltpack implementation, which
		// isn't Keybase-aware). In that case we'll get this NotFoundError, and
		// we can just report it as an unknown sender.
		e.res.SenderType = keybase1.SaltpackSenderType_UNKNOWN
		err = nil
		return
	} else if err != nil {
		return
	}

	loadUserArg := libkb.NewLoadUserByUIDArg(ctx.GetNetContext(), e.G(), maybeUID)
	var user *libkb.User
	user, err = libkb.LoadUser(loadUserArg)
	if err != nil {
		return
	}

	// Use the ComputedKeyFamily assembled by LoadUser to get the status of the
	// key we started with. (This is where we'll detect corner cases like the
	// server straight up lying about who owns a given key. An inconsistency
	// like that will be an error here.)
	var maybeSenderType *keybase1.SaltpackSenderType
	maybeSenderType, err = user.GetComputedKeyFamily().GetSaltpackSenderTypeIfInactive(e.arg.publicKey)
	if err != nil {
		return
	}

	// At this point, since GetSaltpackSenderTypeOrActive has not returned an
	// error, we can consider the UID/username returned by the server to be
	// "mostly legit". It's still possible that the signing key might be
	// revoked (this sort of thing is indicated by a non-nil sender type, which
	// we check for now) or the identify that comes next could report a broken
	// tracking statement, but those are states that we'll report to the user,
	// as opposed to unexpected failures or corner case server lies.
	e.res.Uid = user.GetUID()
	e.res.Username = user.GetName()
	if maybeSenderType != nil {
		e.res.SenderType = *maybeSenderType
		return
	}

	// The key is active! This is the happy path. We'll do an identify and show
	// it to the user, and the SenderType will follow from that.
	err = e.identifySender(ctx)

	return
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
	case identify2TrackBroke:
		e.res.SenderType = keybase1.SaltpackSenderType_TRACKING_BROKE
	default:
		panic("unexpected track type")
	}
	return nil
}

func (e *SaltpackSenderIdentify) Result() keybase1.SaltpackSender {
	return e.res
}
