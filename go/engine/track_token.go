package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

// TrackToken is an engine.
type TrackToken struct {
	libkb.Contextified
	arg                 *TrackTokenArg
	them                *libkb.User
	signingKeyPub       libkb.GenericKey
	signingKeyPriv      libkb.GenericKey
	trackStatementBytes []byte
	trackStatement      *jsonw.Wrapper
	lockedKey           *libkb.SKB
	lockedWhich         string
}

type TrackTokenArg struct {
	Token   libkb.IdentifyCacheToken
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
func (e *TrackToken) Run(ctx *Context) error {
	if len(e.arg.Token) == 0 {
		return fmt.Errorf("missing TrackToken argument")
	}
	if err := e.loadMe(); err != nil {
		e.G().Log.Info("loadme err: %s", err)
		return err
	}

	outcome, err := e.G().IdentifyCache.Get(e.arg.Token)
	if err != nil {
		return err
	}

	if outcome.TrackStatus() == keybase1.TrackStatus_UPDATE_OK {
		e.G().Log.Debug("tracking statement up-to-date.")
		return nil
	}

	if err := e.loadThem(outcome.Username); err != nil {
		return err
	}

	ska := libkb.SecretKeyArg{
		Me:      e.arg.Me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	e.lockedKey, e.lockedWhich, err = e.G().Keyrings.GetSecretKeyLocked(ctx.LoginContext, ska)
	if err != nil {
		e.G().Log.Debug("secretkey err: %s", err)
		return err
	}
	e.lockedKey.SetUID(e.arg.Me.GetUID())
	e.signingKeyPub, err = e.lockedKey.GetPubKey()
	if err != nil {
		e.G().Log.Debug("getpubkey err: %s", err)
		return err
	}

	if e.trackStatement, err = e.arg.Me.TrackingProofFor(e.signingKeyPub, e.them, outcome); err != nil {
		e.G().Log.Debug("tracking proof err: %s", err)
		return err
	}

	if e.trackStatementBytes, err = e.trackStatement.Marshal(); err != nil {
		return err
	}

	e.G().Log.Debug("| Tracking statement: %s", string(e.trackStatementBytes))

	if e.arg.Options.LocalOnly {
		err = e.storeLocalTrack()
	} else {
		err = e.storeRemoteTrack(ctx)
	}
	return err
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

func (e *TrackToken) loadThem(username string) error {
	them, err := libkb.LoadUser(libkb.LoadUserArg{Name: username})
	if err != nil {
		return err
	}
	e.them = them
	return nil
}

func (e *TrackToken) storeLocalTrack() error {
	return libkb.StoreLocalTrack(e.arg.Me.GetUID(), e.them.GetUID(), e.trackStatement)
}

func (e *TrackToken) storeRemoteTrack(ctx *Context) (err error) {
	e.G().Log.Debug("+ StoreRemoteTrack")

	defer func() {
		e.G().Log.Debug("- StoreRemoteTrack -> %s", libkb.ErrToOk(err))
	}()

	var secretStore libkb.SecretStore
	if e.arg.Me != nil {
		e.lockedKey.SetUID(e.arg.Me.GetUID())
		secretStore = libkb.NewSecretStore(e.arg.Me.GetNormalizedName())
	}
	// need to unlock private key
	e.signingKeyPriv, err = e.lockedKey.PromptAndUnlock(ctx.LoginContext, "tracking signature", e.lockedWhich, secretStore, ctx.SecretUI, nil, e.arg.Me)
	if err != nil {
		return err
	}
	if e.signingKeyPriv == nil {
		return libkb.NoSecretKeyError{}
	}

	sig, sigid, err := e.signingKeyPriv.SignToString(e.trackStatementBytes)
	if err != nil {
		return err
	}

	_, err = e.G().API.Post(libkb.APIArg{
		Endpoint:    "follow",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"sig_id_base":  libkb.S{Val: sigid.ToString(false)},
			"sig_id_short": libkb.S{Val: sigid.ToShortID()},
			"sig":          libkb.S{Val: sig},
			"uid":          libkb.UIDArg(e.them.GetUID()),
			"type":         libkb.S{Val: "track"},
			"signing_kid":  e.signingKeyPub.GetKID(),
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
