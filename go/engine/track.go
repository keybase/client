package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	jsonw "github.com/keybase/go-jsonw"
)

type TrackOptions struct {
	TrackLocalOnly bool // true: only track locally, false: track locally and remotely
	TrackApprove   bool // true: don't ask for confirmation, false: ask for confirmation
}

type TrackEngineArg struct {
	TheirName string
	Them      *libkb.User
	Me        *libkb.User

	TrackOptions
}

type TrackEngine struct {
	arg                 *TrackEngineArg
	res                 *IdRes
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
		libkb.TrackUIKind,
		libkb.SecretUIKind,
	}
}

func (s *TrackEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *TrackEngine) Run(ctx *Context, varg interface{}, vres interface{}) error {
	if err := e.loadThem(); err != nil {
		return err
	}
	if err := e.loadMe(); err != nil {
		return err
	}
	if e.arg.Me.Equal(*e.arg.Them) {
		return libkb.SelfTrackError{}
	}

	io, ti, err := e.arg.Them.Identify(libkb.NewIdentifyArg(e.arg.Me, e.arg.Them.GetName(), ctx.TrackUI))
	if err != nil {
		return err
	}

	e.res = &IdRes{Outcome: io, User: e.arg.Them}

	e.signingKeyPub, err = e.arg.Me.SigningKeyPub()
	if err != nil {
		return err
	}

	if e.trackStatement, err = e.arg.Me.TrackingProofFor(e.signingKeyPub, e.arg.Them); err != nil {
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

func (e *TrackEngine) loadThem() error {
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
