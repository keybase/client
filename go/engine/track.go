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
	Me        *libkb.User
	Options   TrackOptions
}

type TrackEngine struct {
	arg                 *TrackEngineArg
	res                 *IDRes
	them                *libkb.User
	signingKeyPub       libkb.GenericKey
	signingKeyPriv      libkb.GenericKey
	trackStatementBytes []byte
	trackStatement      *jsonw.Wrapper
	sig                 string
	sigid               *libkb.SigId
	lockedKey           *libkb.SKB
	lockedWhich         string
	libkb.Contextified
}

// NewTrackEngine creates a default TrackEngine for tracking theirName.
func NewTrackEngine(arg *TrackEngineArg, g *libkb.GlobalContext) *TrackEngine {
	return &TrackEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *TrackEngine) Name() string {
	return "Track"
}

func (e *TrackEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
	}
}

func (e *TrackEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
		libkb.IdentifyUIKind,
	}
}

func (e *TrackEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Identify{},
	}
}

func (e *TrackEngine) Run(ctx *Context) error {
	if err := e.loadMe(); err != nil {
		e.G().Log.Info("loadme err: %s", err)
		return err
	}

	iarg := NewIdentifyTrackArg(e.arg.TheirName, true, e.arg.Options)
	ieng := NewIdentify(iarg, e.G())
	if err := RunEngine(ieng, ctx); err != nil {
		e.G().Log.Info("identify run err: %s", err)
		return err
	}
	ti := ieng.TrackInstructions()
	e.them = ieng.User()

	e.res = &IDRes{Outcome: ieng.Outcome(), User: e.them}

	var err error
	ska := libkb.SecretKeyArg{
		Me:      e.arg.Me,
		KeyType: libkb.AnySecretKeyType,
	}
	e.lockedKey, e.lockedWhich, err = e.G().Keyrings.GetSecretKeyLocked(ctx.LoginContext, ska)
	if err != nil {
		e.G().Log.Info("secretkey err: %s", err)
		return err
	}
	e.lockedKey.SetUID(e.arg.Me.GetUID().P())
	e.signingKeyPub, err = e.lockedKey.GetPubKey()
	if err != nil {
		e.G().Log.Info("getpubkey err: %s", err)
		return err
	}

	if e.trackStatement, err = e.arg.Me.TrackingProofFor(e.signingKeyPub, e.them); err != nil {
		e.G().Log.Info("tracking proof err: %s", err)
		return err
	}

	if e.trackStatementBytes, err = e.trackStatement.Marshal(); err != nil {
		return err
	}

	e.G().Log.Debug("| Tracking statement: %s", string(e.trackStatementBytes))

	if ti.Remote {
		err = e.storeRemoteTrack(ctx)
	} else if ti.Local {
		err = e.storeLocalTrack()
	}

	ctx.IdentifyUI.Finish()

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
	return libkb.StoreLocalTrack(e.arg.Me.GetUID(), e.them.GetUID(), e.trackStatement)
}

func (e *TrackEngine) storeRemoteTrack(ctx *Context) (err error) {
	e.G().Log.Debug("+ StoreRemoteTrack")
	defer e.G().Log.Debug("- StoreRemoteTrack -> %s", libkb.ErrToOk(err))

	// need to unlock private key
	if e.lockedKey == nil {
		return fmt.Errorf("nil locked key")
	}
	e.signingKeyPriv, err = e.lockedKey.PromptAndUnlock(ctx.LoginContext, "tracking signature", e.lockedWhich, nil, ctx.SecretUI, nil)
	if err != nil {
		return err
	}
	if e.signingKeyPriv == nil {
		return libkb.NoSecretKeyError{}
	}

	if e.sig, e.sigid, err = e.signingKeyPriv.SignToString(e.trackStatementBytes); err != nil {
		return err
	}

	_, err = e.G().API.Post(libkb.ApiArg{
		Endpoint:    "follow",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"sig_id_base":  libkb.S{Val: e.sigid.ToString(false)},
			"sig_id_short": libkb.S{Val: e.sigid.ToShortID()},
			"sig":          libkb.S{Val: e.sig},
			"uid":          e.them.GetUID(),
			"type":         libkb.S{Val: "track"},
			"signing_kid":  e.signingKeyPub.GetKid(),
		},
	})

	if err != nil {
		e.G().Log.Info("api error: %s", err)
		return err
	}

	linkid := libkb.ComputeLinkId(e.trackStatementBytes)
	e.arg.Me.SigChainBump(linkid, e.sigid)

	return err
}
