// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type UntrackEngineArg struct {
	Username   libkb.NormalizedUsername
	Me         *libkb.User
	SigVersion libkb.SigVersion
}

type UntrackEngine struct {
	arg                   *UntrackEngineArg
	signingKeyPub         libkb.GenericKey
	untrackStatementBytes []byte
	untrackStatement      *libkb.ProofMetadataRes
	libkb.Contextified
}

// NewUntrackEngine creates a default UntrackEngine for tracking theirName.
func NewUntrackEngine(g *libkb.GlobalContext, arg *UntrackEngineArg) *UntrackEngine {
	if libkb.SigVersion(arg.SigVersion) == libkb.KeybaseNullSigVersion {
		arg.SigVersion = libkb.GetDefaultSigVersion(g)
	}

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
	return []libkb.UIKind{}
}

func (e *UntrackEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *UntrackEngine) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("UntrackEngine#Run", func() error { return err })()

	e.arg.Me, err = e.loadMe()
	if err != nil {
		return
	}

	them, remoteLink, localLink, err := e.loadThem(m)
	if err != nil {
		return
	}

	e.signingKeyPub, err = e.arg.Me.SigningKeyPub()
	if err != nil {
		return
	}

	e.untrackStatement, err = e.arg.Me.UntrackingProofFor(m, e.signingKeyPub, e.arg.SigVersion, them)
	if err != nil {
		return
	}

	e.untrackStatementBytes, err = e.untrackStatement.J.Marshal()
	if err != nil {
		return
	}

	e.G().Log.Debug("| Untracking statement: %s", string(e.untrackStatementBytes))

	didUntrack := false

	if localLink != nil {
		err = e.storeLocalUntrack(m, them)
		if err != nil {
			return
		}
		didUntrack = true
	}

	if remoteLink != nil && !remoteLink.IsRevoked() {
		err = e.storeRemoteUntrack(m, them)
		if err != nil {
			return
		}
		didUntrack = true
	}

	if !didUntrack {
		err = libkb.NewUntrackError("User %s is already untracked", e.arg.Username)
		return
	}

	e.G().UserChanged(m.Ctx(), e.arg.Me.GetUID())
	e.G().UserChanged(m.Ctx(), them.GetUID())

	e.G().NotifyRouter.HandleTrackingChanged(e.arg.Me.GetUID(), e.arg.Me.GetNormalizedName(), false)
	e.G().NotifyRouter.HandleTrackingChanged(them.GetUID(), them.GetNormalizedName(), false)
	m.G().IdentifyDispatch.NotifyTrackingSuccess(m, them.GetUID())

	return
}

func (e *UntrackEngine) loadMe() (me *libkb.User, err error) {
	return libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
}

func (e *UntrackEngine) loadThem(m libkb.MetaContext) (them *libkb.User, remoteLink, localLink *libkb.TrackChainLink, err error) {
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
		res := e.G().Resolver.Resolve(m, e.arg.Username.String())
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

	lLink, err := libkb.LocalTrackChainLinkFor(m, e.arg.Me.GetUID(), uid)
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

func (e *UntrackEngine) storeLocalUntrack(m libkb.MetaContext, them *libkb.User) error {
	// Also do a removal in case of expiring local tracks
	return libkb.RemoveLocalTracks(m, e.arg.Me.GetUID(), them.GetUID())
}

func (e *UntrackEngine) storeRemoteUntrack(m libkb.MetaContext, them *libkb.User) (err error) {
	defer m.Trace("UntrackEngine#StoreRemoteUntrack", func() error { return err })()

	me := e.arg.Me
	arg := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	var signingKey libkb.GenericKey
	if signingKey, err = e.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(arg, "untracking signature")); err != nil {
		return
	}

	sigVersion := libkb.SigVersion(e.arg.SigVersion)
	sig, sigID, linkID, err := libkb.MakeSig(
		m,
		signingKey,
		libkb.LinkTypeUntrack,
		e.untrackStatementBytes,
		false, /* hasRevokes */
		keybase1.SeqType_PUBLIC,
		false, /* ignoreIfUnsupported */
		me,
		sigVersion)

	if err != nil {
		return
	}

	httpsArgs := libkb.HTTPArgs{
		"sig_id_base":  libkb.S{Val: sigID.ToString(false)},
		"sig_id_short": libkb.S{Val: sigID.ToShortID()},
		"sig":          libkb.S{Val: sig},
		"uid":          libkb.UIDArg(them.GetUID()),
		"type":         libkb.S{Val: "untrack"},
		"signing_kid":  e.signingKeyPub.GetKID(),
	}

	if sigVersion == libkb.KeybaseSignatureV2 {
		httpsArgs["sig_inner"] = libkb.S{Val: string(e.untrackStatementBytes)}
	}

	_, err = m.G().API.Post(m, libkb.APIArg{
		Endpoint:    "follow",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        httpsArgs,
	})
	if err != nil {
		return err
	}
	return libkb.MerkleCheckPostedUserSig(m, me.GetUID(), e.untrackStatement.Seqno, linkID)
}
