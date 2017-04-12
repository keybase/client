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
func NewTrackToken(arg *TrackTokenArg, g *libkb.GlobalContext) *TrackToken {
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
		Session: true,
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
func (e *TrackToken) Run(ctx *Context) (err error) {
	e.G().Trace("TrackToken", func() error { return err })()
	if len(e.arg.Token) == 0 {
		err = fmt.Errorf("missing TrackToken argument")
		return err
	}
	if err = e.loadMe(); err != nil {
		e.G().Log.Info("loadme err: %s", err)
		return err
	}

	var outcome *libkb.IdentifyOutcome
	outcome, err = e.G().TrackCache.Get(e.arg.Token)
	if err != nil {
		return err
	}

	if outcome.TrackStatus() == keybase1.TrackStatus_UPDATE_OK && !e.arg.Options.ForceRetrack {
		e.G().Log.Debug("tracking statement up-to-date.")
		return nil
	}

	if err = e.loadThem(outcome.Username); err != nil {
		return err
	}

	if e.arg.Me.Equal(e.them) {
		err = libkb.SelfTrackError{}
		return err
	}

	if err = e.isTrackTokenStale(outcome); err != nil {
		e.G().Log.Debug("Track statement is stale")
		return err
	}

	// need public signing key for track statement
	signingKeyPub, err := e.arg.Me.SigningKeyPub()
	if err != nil {
		return err
	}
	if e.trackStatement, err = e.arg.Me.TrackingProofFor(signingKeyPub, e.them, outcome); err != nil {
		e.G().Log.Debug("tracking proof err: %s", err)
		return err
	}

	if e.trackStatementBytes, err = e.trackStatement.Marshal(); err != nil {
		return err
	}

	e.G().Log.Debug("| Tracking statement: %s", string(e.trackStatementBytes))

	if e.arg.Options.LocalOnly || e.arg.Options.ExpiringLocal {
		e.G().Log.Debug("| Local")
		err = e.storeLocalTrack()
	} else {
		err = e.storeRemoteTrack(ctx, signingKeyPub.GetKID())
		if err == nil {
			// if the remote track succeeded, remove local tracks
			// (this also removes any snoozes)
			e.removeLocalTracks()
		}
	}

	if err == nil {
		// Remove this after desktop notification change complete:
		e.G().UserChanged(e.them.GetUID())

		// Remove these after desktop notification change complete, but
		// add in: e.G().BustLocalUserCache(e.arg.Me.GetUID())
		e.G().UserChanged(e.arg.Me.GetUID())

		// Keep these:
		e.G().NotifyRouter.HandleTrackingChanged(e.arg.Me.GetUID(), e.arg.Me.GetNormalizedName(), false)
		e.G().NotifyRouter.HandleTrackingChanged(e.them.GetUID(), e.them.GetNormalizedName(), true)

		// Dismiss any associated gregor item.
		if outcome.ResponsibleGregorItem != nil {
			err = e.G().GregorDismisser.DismissItem(outcome.ResponsibleGregorItem.Metadata().MsgID())
		}
	}

	return err
}

func (e *TrackToken) isTrackTokenStale(o *libkb.IdentifyOutcome) (err error) {
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
		e.G().Log.Debug("Stale track! We were at seqno %d, but %d is already in chain", o.TrackUsed.GetTrackerSeqno(), lastTrack.GetSeqno())
		return libkb.TrackStaleError{FirstTrack: false}
	}
	return nil
}

func (e *TrackToken) loadMe() error {
	if e.arg.Me != nil {
		return nil
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}
	e.arg.Me = me
	return nil
}

func (e *TrackToken) loadThem(username libkb.NormalizedUsername) error {

	arg := libkb.NewLoadUserByNameArg(e.G(), username.String())
	arg.PublicKeyOptional = true
	them, err := libkb.LoadUser(arg)
	if err != nil {
		return err
	}
	e.them = them
	return nil
}

func (e *TrackToken) storeLocalTrack() error {
	return libkb.StoreLocalTrack(e.arg.Me.GetUID(), e.them.GetUID(), e.arg.Options.ExpiringLocal, e.trackStatement, e.G())
}

func (e *TrackToken) storeRemoteTrack(ctx *Context, pubKID keybase1.KID) (err error) {
	e.G().Log.Debug("+ StoreRemoteTrack")
	defer func() {
		e.G().Log.Debug("- StoreRemoteTrack -> %s", libkb.ErrToOk(err))
	}()

	// need unlocked signing key
	ska := libkb.SecretKeyArg{
		Me:      e.arg.Me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	arg := ctx.SecretKeyPromptArg(ska, "tracking signature")
	signingKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(arg)
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

	sig, sigid, err := signingKey.SignToString(e.trackStatementBytes)
	if err != nil {
		return err
	}

	_, err = e.G().API.Post(libkb.APIArg{
		Endpoint:    "follow",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig_id_base":  libkb.S{Val: sigid.ToString(false)},
			"sig_id_short": libkb.S{Val: sigid.ToShortID()},
			"sig":          libkb.S{Val: sig},
			"uid":          libkb.UIDArg(e.them.GetUID()),
			"type":         libkb.S{Val: "track"},
			"signing_kid":  signingKey.GetKID(),
		},
	})

	if err != nil {
		e.G().Log.Info("api error: %s", err)
		return err
	}

	linkid := libkb.ComputeLinkID(e.trackStatementBytes)
	e.arg.Me.SigChainBump(linkid, sigid)

	return err
}

func (e *TrackToken) removeLocalTracks() (err error) {
	defer e.G().Trace("removeLocalTracks", func() error { return err })()
	err = libkb.RemoveLocalTracks(e.arg.Me.GetUID(), e.them.GetUID(), e.G())
	return err
}
