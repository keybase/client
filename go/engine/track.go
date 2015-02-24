package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	jsonw "github.com/keybase/go-jsonw"
)

type TrackEngineArg struct {
	TheirName string
	Them      *libkb.User
	Me        *libkb.User

	NonInteractive bool
	AllowTrackSelf bool
	StrictProofs   bool
	MeNotRequired  bool
}

type TrackEngine struct {
	arg *TrackEngineArg

	trackStatementBytes []byte
	trackStatement      *jsonw.Wrapper
	signingKeyPriv      libkb.GenericKey
	sig                 string
	sigid               *libkb.SigId
	lockedKey           *libkb.SKB
	signingKeyPub       libkb.GenericKey
}

// NewTrackEngine creates a default TrackEngine for tracking theirName.
func NewTrackEngine(arg *TrackEngineArg) *TrackEngine {
	return &TrackEngine{arg: arg}
}

func (s *TrackEngine) Name() string {
	return "Track"
}

func (e *TrackEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
	}
}

func (k *TrackEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.TrackUIKind,
		libkb.SecretUIKind,
	}
}

func (s *TrackEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *TrackEngine) LoadThem() error {
	if e.arg.Them == nil && len(e.arg.TheirName) == 0 {
		return fmt.Errorf("No 'them' passed to TrackEngine")
	}
	if e.arg.Them == nil {
		if u, err := libkb.LoadUser(libkb.LoadUserArg{
			Name:        e.arg.TheirName,
			Self:        false,
			ForceReload: false,
		}); err != nil {
			return err
		} else {
			e.arg.Them = u
		}
	}
	return nil
}

func (e *TrackEngine) LoadMe() error {
	if e.arg.Me == nil {
		if me, err := libkb.LoadMe(libkb.LoadUserArg{}); err != nil && !e.arg.MeNotRequired {
			return err
		} else {
			e.arg.Me = me
		}
	}
	return nil
}

func (e *TrackEngine) GetSigningKeyPub() (err error) {
	// Get out key that we're going to sign with.
	arg := libkb.SecretKeyArg{Me: e.arg.Me, All: true}
	if e.lockedKey, _, err = G.Keyrings.GetSecretKeyLocked(arg); err != nil {
		return
	}
	if e.signingKeyPub, err = e.lockedKey.GetPubKey(); err != nil {
		return
	}
	return
}

func (e *TrackEngine) Run(ctx *Context, varg interface{}, vres interface{}) (err error) {
	if err = e.LoadThem(); err != nil {
		return
	} else if err = e.LoadMe(); err != nil {
		return
	} else if !e.arg.AllowTrackSelf && e.arg.Me.Equal(*e.arg.Them) {
		err = libkb.SelfTrackError{}
		return
	}

	var ti libkb.TrackInstructions
	_, ti, err = e.arg.Them.Identify(libkb.IdentifyArg{
		Me: e.arg.Me,
		Ui: ctx.TrackUI,
	})

	if err != nil {
		return
	}

	if err = e.GetSigningKeyPub(); err != nil {
		return
	}

	if e.trackStatement, err = e.arg.Me.TrackingProofFor(e.signingKeyPub, e.arg.Them); err != nil {
		return
	}

	if e.trackStatementBytes, err = e.trackStatement.Marshal(); err != nil {
		return
	}

	G.Log.Debug("| Tracking statement: %s", string(e.trackStatementBytes))

	if ti.Remote {
		err = e.storeRemoteTrack(ctx)
	} else if ti.Local {
		err = e.storeLocalTrack()
	}
	return
}

func (e *TrackEngine) storeLocalTrack() error {
	return libkb.StoreLocalTrack(e.arg.Me.GetUid(), e.arg.Them.GetUid(), e.trackStatement)
}

func (e *TrackEngine) storeRemoteTrack(ctx *Context) (err error) {
	G.Log.Debug("+ StoreRemoteTrack")
	defer G.Log.Debug("- StoreRemoteTrack -> %s", libkb.ErrToOk(err))

	arg := libkb.SecretKeyArg{Reason: "tracking signature", Ui: ctx.SecretUI, Me: e.arg.Me, All: true}
	if e.signingKeyPriv, err = G.Keyrings.GetSecretKey(arg); err != nil {
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
			"uid":          e.arg.Them.GetUid(),
			"type":         libkb.S{Val: "track"},
			"signing_kid":  e.signingKeyPub.GetKid(),
		},
	})

	return
}

// this requires an engine, so put it in this package
func TrackStatementJSON(me, them *libkb.User) (string, error) {
	eng := NewTrackEngine(&TrackEngineArg{Them: them})
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
