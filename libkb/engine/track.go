package engine

import (
	"fmt"

	jsonw "github.com/keybase/go-jsonw"
	"github.com/keybase/go/libkb"
)

type TrackEngine struct {
	TheirName    string
	Them         *libkb.User
	Me           *libkb.User
	Interactive  bool
	NoSelf       bool
	StrictProofs bool
	MeRequired   bool

	trackStatementBytes []byte
	trackStatement      *jsonw.Wrapper
	signingKeyPriv      libkb.GenericKey
	sig                 string
	sigid               *libkb.SigId
	lockedKey           *libkb.P3SKB
	signingKeyPub       libkb.GenericKey
	idUI                libkb.IdentifyUI
	secretUI            libkb.SecretUI
}

// NewTrackEngine creates a default TrackEngine for tracking theirName.
func NewTrackEngine(theirName string, ui libkb.IdentifyUI, sui libkb.SecretUI) *TrackEngine {
	return &TrackEngine{
		TheirName:    theirName,
		NoSelf:       true,
		Interactive:  true,
		Me:           nil,
		StrictProofs: false,
		MeRequired:   true,
		idUI:         ui,
		secretUI:     sui,
	}
}

func (e *TrackEngine) UI() libkb.IdentifyUI {
	if e.idUI == nil {
		e.idUI = G.UI.GetIdentifyTrackUI(e.Them.GetName(), e.StrictProofs)
	}
	return e.idUI
}

func (e *TrackEngine) SecretUI() libkb.SecretUI {
	if e.secretUI == nil {
		e.secretUI = G.UI.GetSecretUI()
	}
	return e.secretUI
}

func (e *TrackEngine) LoadThem() error {
	if e.Them == nil && len(e.TheirName) == 0 {
		return fmt.Errorf("No 'them' passed to TrackEngine")
	}
	if e.Them == nil {
		if u, err := libkb.LoadUser(libkb.LoadUserArg{
			Name:        e.TheirName,
			Self:        false,
			ForceReload: false,
		}); err != nil {
			return err
		} else {
			e.Them = u
		}
	}
	return nil
}

func (e *TrackEngine) LoadMe() error {
	if e.Me == nil {
		if me, err := libkb.LoadMe(libkb.LoadUserArg{}); err != nil && e.MeRequired {
			return err
		} else {
			e.Me = me
		}
	}
	return nil
}

func (e *TrackEngine) GetSigningKeyPub() (err error) {
	// Get out key that we're going to sign with.
	if e.lockedKey, _, err = G.Keyrings.GetSecretKeyLocked(e.Me, false); err != nil {
		return
	}
	if e.signingKeyPub, err = e.lockedKey.GetPubKey(); err != nil {
		return
	}
	return
}

func (e *TrackEngine) Run() (err error) {
	if err = e.LoadThem(); err != nil {
		return
	} else if err = e.LoadMe(); err != nil {
		return
	} else if e.NoSelf && e.Me.Equal(*e.Them) {
		err = libkb.SelfTrackError{}
		return
	}

	var ti libkb.TrackInstructions
	_, ti, err = e.Them.Identify(libkb.IdentifyArg{
		Me: e.Me,
		Ui: e.UI(),
	})

	if err != nil {
		return
	}

	if err = e.GetSigningKeyPub(); err != nil {
		return
	}

	if e.trackStatement, err = e.Me.TrackingProofFor(e.signingKeyPub, e.Them); err != nil {
		return
	}

	if e.trackStatementBytes, err = e.trackStatement.Marshal(); err != nil {
		return
	}

	G.Log.Debug("| Tracking statement: %s", string(e.trackStatementBytes))

	if ti.Remote {
		err = e.StoreRemoteTrack()
	} else if ti.Local {
		err = e.StoreLocalTrack()
	}
	return
}

func (e *TrackEngine) StoreLocalTrack() error {
	return libkb.StoreLocalTrack(e.Them.GetUid(), e.trackStatement)
}

func (e *TrackEngine) StoreRemoteTrack() (err error) {
	G.Log.Debug("+ StoreRemoteTrack")
	defer G.Log.Debug("- StoreRemoteTrack -> %s", libkb.ErrToOk(err))

	if e.signingKeyPriv, err = G.Keyrings.GetSecretKey("tracking signature", e.SecretUI(), false); err != nil {
		return
	} else if e.signingKeyPriv == nil {
		err = libkb.NoSecretKeyError{}
		return
	}

	if e.sig, e.sigid, err = e.signingKeyPriv.SignToString(e.trackStatementBytes); err != nil {
		return
	}

	_, err = G.API.Post(libkb.ApiArg{
		Endpoint:    "follow",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"sig_id_base":  libkb.S{Val: e.sigid.ToString(false)},
			"sig_id_short": libkb.S{Val: e.sigid.ToShortId()},
			"sig":          libkb.S{Val: e.sig},
			"uid":          e.Them.GetUid(),
			"type":         libkb.S{Val: "track"},
			"signing_kid":  e.signingKeyPub.GetKid(),
		},
	})

	return
}

// this requires an engine, so put it in this package
func TrackStatementJSON(me, them *libkb.User) (string, error) {
	eng := NewTrackEngine(them.GetName(), nil, nil)
	if err := eng.GetSigningKeyPub(); err != nil {
		return "", err
	}

	stmt, err := me.TrackingProofFor(eng.signingKeyPub, them)
	if err != nil {
		return "", err
	}
	json, err := stmt.Marshal()
	if err != nil {
		return "", err
	}
	return string(json), nil
}
