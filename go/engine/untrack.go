// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type UntrackEngineArg struct {
	Username libkb.NormalizedUsername
	Me       *libkb.User
}

type UntrackEngine struct {
	arg                   *UntrackEngineArg
	signingKeyPub         libkb.GenericKey
	untrackStatementBytes []byte
	libkb.Contextified
}

// NewUntrackEngine creates a default UntrackEngine for tracking theirName.
func NewUntrackEngine(arg *UntrackEngineArg, g *libkb.GlobalContext) *UntrackEngine {
	return &UntrackEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *UntrackEngine) Name() string {
	return "Untrack"
}

func (e *UntrackEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *UntrackEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

func (e *UntrackEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *UntrackEngine) Run(ctx *Context) (err error) {
	e.G().LocalSigchainGuard().Set(ctx.GetNetContext(), "UntrackEngine")
	defer e.G().LocalSigchainGuard().Clear(ctx.GetNetContext(), "UntrackEngine")

	e.arg.Me, err = e.loadMe()
	if err != nil {
		return
	}

	them, remoteLink, localLink, err := e.loadThem()
	if err != nil {
		return
	}

	e.signingKeyPub, err = e.arg.Me.SigningKeyPub()
	if err != nil {
		return
	}

	untrackStatement, err := e.arg.Me.UntrackingProofFor(e.signingKeyPub, them)
	if err != nil {
		return
	}

	e.untrackStatementBytes, err = untrackStatement.Marshal()
	if err != nil {
		return
	}

	e.G().Log.Debug("| Untracking statement: %s", string(e.untrackStatementBytes))

	didUntrack := false

	if localLink != nil {
		err = e.storeLocalUntrack(them)
		if err != nil {
			return
		}
		didUntrack = true
	}

	if remoteLink != nil && !remoteLink.IsRevoked() {
		err = e.storeRemoteUntrack(them, ctx)
		if err != nil {
			return
		}
		didUntrack = true
	}

	if !didUntrack {
		err = libkb.NewUntrackError("User %s is already untracked", e.arg.Username)
		return
	}

	e.G().UserChanged(e.arg.Me.GetUID())
	e.G().UserChanged(them.GetUID())

	e.G().NotifyRouter.HandleTrackingChanged(e.arg.Me.GetUID(), e.arg.Me.GetNormalizedName(), false)
	e.G().NotifyRouter.HandleTrackingChanged(them.GetUID(), them.GetNormalizedName(), false)

	return
}

func (e *UntrackEngine) loadMe() (me *libkb.User, err error) {
	return libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
}

func (e *UntrackEngine) loadThem() (them *libkb.User, remoteLink, localLink *libkb.TrackChainLink, err error) {
	var rLink *libkb.TrackChainLink
	trackMap := e.arg.Me.IDTable().GetTrackMap()
	if links, ok := trackMap[e.arg.Username]; ok && (len(links) > 0) {
		rLink = links[len(links)-1]
	}

	var uid keybase1.UID
	uidTrusted := false
	if rLink != nil {
		if uid, err = rLink.GetTrackedUID(); err != nil {
			return
		}
		uidTrusted = true
	}

	if uid.IsNil() {
		res := e.G().Resolver.Resolve(e.arg.Username.String())
		if err = res.GetError(); err != nil {
			return
		}

		// This is an untrusted uid.
		uid = res.GetUID()
		if uid.IsNil() {
			err = libkb.NewUntrackError("Could not resolve uid for @%s", e.arg.Username)
			return
		}
	}

	lLink, err := libkb.LocalTrackChainLinkFor(e.arg.Me.GetUID(), uid, e.G())
	if err != nil {
		return
	}

	if rLink == nil && lLink == nil {
		err = libkb.NewUntrackError("You are not tracking %s", e.arg.Username)
		return
	}

	if !uidTrusted {
		if lLink == nil {
			err = libkb.NewUntrackError("Could not verify resolved uid for @%s", e.arg.Username)
			return
		}

		var trackedUsername libkb.NormalizedUsername
		trackedUsername, err = lLink.GetTrackedUsername()
		if err != nil {
			return
		}

		if !e.arg.Username.Eq(trackedUsername) {
			err = libkb.NewUntrackError("Username mismatch: expected @%s, got @%s", e.arg.Username, trackedUsername)
			return
		}

		uidTrusted = true
	}

	them = libkb.NewUserThin(e.arg.Username.String(), uid)
	remoteLink = rLink
	localLink = lLink
	return
}

func (e *UntrackEngine) storeLocalUntrack(them *libkb.User) error {
	// Also do a removal in case of expiring local tracks
	return libkb.RemoveLocalTracks(e.arg.Me.GetUID(), them.GetUID(), e.G())
}

func (e *UntrackEngine) storeRemoteUntrack(them *libkb.User, ctx *Context) (err error) {
	e.G().Log.Debug("+ StoreRemoteUntrack")
	defer e.G().Log.Debug("- StoreRemoteUntrack -> %s", libkb.ErrToOk(err))

	arg := libkb.SecretKeyArg{
		Me:      e.arg.Me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	var signingKeyPriv libkb.GenericKey
	if signingKeyPriv, err = e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(arg, "untracking signature")); err != nil {
		return
	}

	var sig string
	var sigid keybase1.SigID
	if sig, sigid, err = signingKeyPriv.SignToString(e.untrackStatementBytes); err != nil {
		return
	}

	_, err = e.G().API.Post(libkb.APIArg{
		Endpoint:    "follow",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig_id_base":  libkb.S{Val: sigid.ToString(false)},
			"sig_id_short": libkb.S{Val: sigid.ToShortID()},
			"sig":          libkb.S{Val: sig},
			"uid":          libkb.UIDArg(them.GetUID()),
			"type":         libkb.S{Val: "untrack"},
			"signing_kid":  e.signingKeyPub.GetKID(),
		},
	})

	return
}
