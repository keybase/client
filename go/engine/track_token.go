// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// TrackToken is an engine.
type TrackToken struct {
	libkb.Contextified
	arg                 *TrackTokenArg
	them                *libkb.User
	trackStatementBytes []byte
	trackStatement      *jsonw.Wrapper
}

type TrackTokenArg struct {
	Token   keybase1.TrackToken
	Me      *libkb.User
	Options keybase1.TrackOptions
}

// NewTrackToken creates a TrackToken engine.
func NewTrackToken(g *libkb.GlobalContext, arg *TrackTokenArg) *TrackToken {
	if arg.Options.SigVersion == nil || libkb.SigVersion(*arg.Options.SigVersion) == libkb.KeybaseNullSigVersion {
		tmp := keybase1.SigVersion(libkb.GetDefaultSigVersion(g))
		arg.Options.SigVersion = &tmp
	}

	return &TrackToken{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *TrackToken) Name() string {
	return "TrackToken"
}

// GetPrereqs returns the engine prereqs.
func (e *TrackToken) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *TrackToken) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *TrackToken) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *TrackToken) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("TrackToken#Run", func() error { return err })()

	if len(e.arg.Token) == 0 {
		err = fmt.Errorf("missing TrackToken argument")
		return err
	}
	if err = e.loadMe(m); err != nil {
		m.CInfof("loadme err: %s", err)
		return err
	}

	var outcome *libkb.IdentifyOutcome
	outcome, err = m.G().TrackCache().Get(e.arg.Token)
	if err != nil {
		return err
	}

	if outcome.TrackStatus() == keybase1.TrackStatus_UPDATE_OK && !e.arg.Options.ForceRetrack {
		m.CDebugf("tracking statement up-to-date.")
		return nil
	}

	if err = e.loadThem(m, outcome.Username); err != nil {
		return err
	}

	if e.arg.Me.Equal(e.them) {
		err = libkb.SelfTrackError{}
		return err
	}

	if err = e.isTrackTokenStale(m, outcome); err != nil {
		m.CDebugf("Track statement is stale")
		return err
	}

	// need public signing key for track statement
	signingKeyPub, err := e.arg.Me.SigningKeyPub()
	if err != nil {
		return err
	}

	e.trackStatement, err = e.arg.Me.TrackingProofFor(m, signingKeyPub, libkb.SigVersion(*e.arg.Options.SigVersion), e.them, outcome)
	if err != nil {
		m.CDebugf("tracking proof err: %s", err)
		return err
	}
	if e.trackStatementBytes, err = e.trackStatement.Marshal(); err != nil {
		return err
	}

	m.CDebugf("| Tracking statement: %s", string(e.trackStatementBytes))

	if e.arg.Options.LocalOnly || e.arg.Options.ExpiringLocal {
		m.CDebugf("| Local")
		err = e.storeLocalTrack(m)
	} else {
		err = e.storeRemoteTrack(m, signingKeyPub.GetKID())
		if err == nil {
			// if the remote track succeeded, remove local tracks
			// (this also removes any snoozes)
			e.removeLocalTracks(m)
		}
	}

	if err == nil {
		// Remove this after desktop notification change complete:
		m.G().UserChanged(e.them.GetUID())

		// Remove these after desktop notification change complete, but
		// add in: m.G().BustLocalUserCache(e.arg.Me.GetUID())
		m.G().UserChanged(e.arg.Me.GetUID())

		// Keep these:
		m.G().NotifyRouter.HandleTrackingChanged(e.arg.Me.GetUID(), e.arg.Me.GetNormalizedName(), false)
		m.G().NotifyRouter.HandleTrackingChanged(e.them.GetUID(), e.them.GetNormalizedName(), true)

		// Dismiss any associated gregor item.
		if outcome.ResponsibleGregorItem != nil {
			err = m.G().GregorDismisser.DismissItem(m.Ctx(), nil, outcome.ResponsibleGregorItem.Metadata().MsgID())
		}
	}

	return err
}

func (e *TrackToken) isTrackTokenStale(m libkb.MetaContext, o *libkb.IdentifyOutcome) (err error) {
	if idt := e.arg.Me.IDTable(); idt == nil {
		return nil
	} else if tm := idt.GetTrackMap(); tm == nil {
		return nil
	} else if v := tm[o.Username]; len(v) == 0 {
		return nil
	} else if lastTrack := v[len(v)-1]; lastTrack != nil && !lastTrack.IsRevoked() && o.TrackUsed == nil {
		// If we had a valid track that we didn't use in the identification, then
		// someone must have slipped in before us. Distinguish this case from the
		// other case below for the purposes of testing, to make sure we hit
		// both error cases in our tests.
		return libkb.TrackStaleError{FirstTrack: true}
	} else if o.TrackUsed == nil || lastTrack == nil {
		return nil
	} else if o.TrackUsed.GetTrackerSeqno() < lastTrack.GetSeqno() {
		// Similarly, if there was a last track for this user that wasn't the
		// one we were expecting, someone also must have intervened.
		m.CDebugf("Stale track! We were at seqno %d, but %d is already in chain", o.TrackUsed.GetTrackerSeqno(), lastTrack.GetSeqno())
		return libkb.TrackStaleError{FirstTrack: false}
	}
	return nil
}

func (e *TrackToken) loadMe(m libkb.MetaContext) error {
	if e.arg.Me != nil {
		return nil
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return err
	}
	e.arg.Me = me
	return nil
}

func (e *TrackToken) loadThem(m libkb.MetaContext, username libkb.NormalizedUsername) error {

	arg := libkb.NewLoadUserArgWithMetaContext(m).WithName(username.String()).WithPublicKeyOptional()
	them, err := libkb.LoadUser(arg)
	if err != nil {
		return err
	}
	e.them = them
	return nil
}

func (e *TrackToken) storeLocalTrack(m libkb.MetaContext) error {
	return libkb.StoreLocalTrack(m, e.arg.Me.GetUID(), e.them.GetUID(), e.arg.Options.ExpiringLocal, e.trackStatement)
}

func (e *TrackToken) storeRemoteTrack(m libkb.MetaContext, pubKID keybase1.KID) (err error) {
	defer m.CTrace("TrackToken#StoreRemoteTrack", func() error { return err })()

	// need unlocked signing key
	me := e.arg.Me
	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	arg := m.SecretKeyPromptArg(ska, "tracking signature")
	signingKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, arg)
	if err != nil {
		return err
	}
	if signingKey == nil {
		return libkb.NoSecretKeyError{}
	}
	// double-check that the KID of the unlocked key matches
	if signingKey.GetKID().NotEqual(pubKID) {
		return errors.New("unexpeceted KID mismatch between locked and unlocked signing key")
	}

	sigVersion := libkb.SigVersion(*e.arg.Options.SigVersion)
	sig, sigID, linkID, err := libkb.MakeSig(
		m,
		signingKey,
		libkb.LinkTypeTrack,
		e.trackStatementBytes,
		libkb.SigHasRevokes(false),
		keybase1.SeqType_PUBLIC,
		libkb.SigIgnoreIfUnsupported(false),
		me,
		sigVersion,
	)

	if err != nil {
		return err
	}

	httpsArgs := libkb.HTTPArgs{
		"sig_id_base":  libkb.S{Val: sigID.ToString(false)},
		"sig_id_short": libkb.S{Val: sigID.ToShortID()},
		"sig":          libkb.S{Val: sig},
		"uid":          libkb.UIDArg(e.them.GetUID()),
		"type":         libkb.S{Val: "track"},
		"signing_kid":  signingKey.GetKID(),
	}

	if sigVersion == libkb.KeybaseSignatureV2 {
		httpsArgs["sig_inner"] = libkb.S{Val: string(e.trackStatementBytes)}
	}
	_, err = m.G().API.Post(libkb.APIArg{
		Endpoint:    "follow",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        httpsArgs,
		NetContext:  m.Ctx(),
	})

	if err != nil {
		m.CWarningf("api error: %s", err)
		return err
	}

	me.SigChainBump(linkID, sigID, false)

	return err
}

func (e *TrackToken) removeLocalTracks(m libkb.MetaContext) (err error) {
	defer m.CTrace("removeLocalTracks", func() error { return err })()
	err = libkb.RemoveLocalTracks(m, e.arg.Me.GetUID(), e.them.GetUID())
	return err
}
