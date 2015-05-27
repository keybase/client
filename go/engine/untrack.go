package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type UntrackEngineArg struct {
	TheirName string
	Me        *libkb.User
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

func (e *UntrackEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
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
		err = libkb.NewUntrackError("User @%s is already untracked", e.arg.TheirName)
		return
	}

	return
}

func (e *UntrackEngine) loadMe() (me *libkb.User, err error) {
	return libkb.LoadMe(libkb.LoadUserArg{})
}

func (e *UntrackEngine) loadThem() (them *libkb.User, remoteLink, localLink *libkb.TrackChainLink, err error) {
	var rLink *libkb.TrackChainLink
	trackMap := e.arg.Me.IDTable().GetTrackMap()
	if links, ok := trackMap[e.arg.TheirName]; ok && (len(links) > 0) {
		rLink = links[len(links)-1]
	}

	var uid keybase1.UID
	uidTrusted := false
	if rLink != nil {
		if uid, err = rLink.GetTrackedUid(); err != nil {
			return
		}
		uidTrusted = true
	}

	if len(uid) == 0 {
		res := libkb.ResolveUid(e.arg.TheirName)
		if err = res.GetError(); err != nil {
			return
		}

		// This is an untrusted uid.
		if uid = res.GetUID(); len(uid) == 0 {
			err = libkb.NewUntrackError("Could not resolve uid for @%s", e.arg.TheirName)
			return
		}
	}

	lLink, err := libkb.GetLocalTrack(e.arg.Me.GetUID(), uid)
	if err != nil {
		return
	}

	if !uidTrusted {
		if lLink == nil {
			err = libkb.NewUntrackError("Could not verify resolved uid for @%s", e.arg.TheirName)
			return
		}

		var trackedUsername string
		trackedUsername, err = lLink.GetTrackedUsername()
		if err != nil {
			return
		}

		if e.arg.TheirName != trackedUsername {
			err = libkb.NewUntrackError("Username mismatch: expected @%s, got @%s", e.arg.TheirName, trackedUsername)
			return
		}

		uidTrusted = true
	}

	them = libkb.NewUserThin(e.arg.TheirName, uid)
	remoteLink = rLink
	localLink = lLink
	return
}

func (e *UntrackEngine) storeLocalUntrack(them *libkb.User) error {
	return libkb.RemoveLocalTrack(e.arg.Me.GetUID(), them.GetUID())
}

func (e *UntrackEngine) storeRemoteUntrack(them *libkb.User, ctx *Context) (err error) {
	e.G().Log.Debug("+ StoreRemoteUntrack")
	defer e.G().Log.Debug("- StoreRemoteUntrack -> %s", libkb.ErrToOk(err))

	arg := libkb.SecretKeyArg{
		Me:      e.arg.Me,
		KeyType: libkb.AnySecretKeyType,
	}
	var signingKeyPriv libkb.GenericKey
	if signingKeyPriv, _, err = e.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, arg, ctx.SecretUI, "untracking signature"); err != nil {
		return
	}

	var sig string
	var sigid keybase1.SigID
	if sig, sigid, err = signingKeyPriv.SignToString(e.untrackStatementBytes); err != nil {
		return
	}

	_, err = e.G().API.Post(libkb.ApiArg{
		Endpoint:    "follow",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"sig_id_base":  libkb.S{Val: sigid.ToString(false)},
			"sig_id_short": libkb.S{Val: sigid.ToShortID()},
			"sig":          libkb.S{Val: sig},
			"uid":          libkb.UIDArg(them.GetUID()),
			"type":         libkb.S{Val: "untrack"},
			"signing_kid":  e.signingKeyPub.GetKid(),
		},
	})

	return
}
