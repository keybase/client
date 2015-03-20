package engine

import (
	"github.com/keybase/client/go/libkb"
	jsonw "github.com/keybase/go-jsonw"
)

type TrackOptions struct {
	TrackLocalOnly bool // true: only track locally, false: track locally and remotely
	TrackApprove   bool // true: don't ask for confirmation, false: ask for confirmation
}

type TrackEngineArg struct {
	TheirName string
	Me        *libkb.User
	Options   TrackOptions
}

type TrackEngine struct {
	arg                 *TrackEngineArg
	res                 *IdRes
	them                *libkb.User
	signingKeyPub       libkb.GenericKey
	signingKeyPriv      libkb.GenericKey
	trackStatementBytes []byte
	trackStatement      *jsonw.Wrapper
	sig                 string
	sigid               *libkb.SigId
	lockedKey           *libkb.SKB
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
		libkb.SecretUIKind,
	}
}

func (s *TrackEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewIdentify(nil),
	}
}

func (e *TrackEngine) Run(ctx *Context) error {
	if err := e.loadMe(); err != nil {
		return err
	}

	iarg := NewIdentifyTrackArg(e.arg.TheirName, true, e.arg.Options)
	ieng := NewIdentify(iarg)
	if err := RunEngine(ieng, ctx); err != nil {
		return err
	}
	ti := ieng.TrackInstructions()
	e.them = ieng.User()

	e.res = &IdRes{Outcome: ieng.Outcome(), User: e.them}

	var err error
	e.signingKeyPub, err = e.arg.Me.SigningKeyPub()
	if err != nil {
		return err
	}

	if e.trackStatement, err = e.arg.Me.TrackingProofFor(e.signingKeyPub, e.them); err != nil {
		return err
	}

	if e.trackStatementBytes, err = e.trackStatement.Marshal(); err != nil {
		return err
	}

	G.Log.Debug("| Tracking statement: %s", string(e.trackStatementBytes))

	if ti.Remote {
		err = e.storeRemoteTrack(ctx)
	} else if ti.Local {
		err = e.storeLocalTrack()
	}
	return err
}

func (e *TrackEngine) User() *libkb.User {
	return e.them
}

func (e *TrackEngine) loadMe() error {
	if e.arg.Me != nil {
		return nil
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	e.arg.Me = me
	return nil
}

func (e *TrackEngine) storeLocalTrack() error {
	return libkb.StoreLocalTrack(e.arg.Me.GetUid(), e.them.GetUid(), e.trackStatement)
}

func (e *TrackEngine) storeRemoteTrack(ctx *Context) (err error) {
	G.Log.Debug("+ StoreRemoteTrack")
	defer G.Log.Debug("- StoreRemoteTrack -> %s", libkb.ErrToOk(err))

	arg := libkb.SecretKeyArg{Reason: "tracking signature", Ui: ctx.SecretUI, Me: e.arg.Me, All: true}
	if e.signingKeyPriv, _, err = G.Keyrings.GetSecretKey(arg); err != nil {
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
			"uid":          e.them.GetUid(),
			"type":         libkb.S{Val: "track"},
			"signing_kid":  e.signingKeyPub.GetKid(),
		},
	})

	return
}
