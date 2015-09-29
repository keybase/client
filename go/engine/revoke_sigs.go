package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type RevokeSigsEngine struct {
	libkb.Contextified
	sigIDs []keybase1.SigID
}

func NewRevokeSigsEngine(sigIDs []keybase1.SigID, g *libkb.GlobalContext) *RevokeSigsEngine {
	return &RevokeSigsEngine{
		sigIDs:       sigIDs,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *RevokeSigsEngine) Name() string {
	return "RevokeSigs"
}

func (e *RevokeSigsEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *RevokeSigsEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *RevokeSigsEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *RevokeSigsEngine) getSigIDsToRevoke(me *libkb.User) ([]keybase1.SigID, error) {
	ret := make([]keybase1.SigID, len(e.sigIDs))
	copy(ret, e.sigIDs)
	for _, sigID := range ret {
		valid, err := me.IsSigIDActive(sigID)
		if err != nil {
			return nil, err
		}
		if !valid {
			return nil, fmt.Errorf("Signature '%s' does not exist.", sigID)
		}
	}
	return ret, nil
}

func (e *RevokeSigsEngine) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	sigIDsToRevoke, err := e.getSigIDsToRevoke(me)
	if err != nil {
		return err
	}

	sigKey, _, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}, ctx.SecretUI, "to revoke a signature")
	if sigKey == nil {
		return fmt.Errorf("Revocation signing key is nil.")
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}
	proof, err := me.RevokeSigsProof(sigKey, sigIDsToRevoke)
	if err != nil {
		return err
	}
	sig, _, _, err := libkb.SignJSON(proof, sigKey)
	if err != nil {
		return err
	}
	kid := sigKey.GetKID()
	_, err = e.G().API.Post(libkb.APIArg{
		Endpoint:    "sig/revoke",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"signing_kid": libkb.S{Val: kid.String()},
			"sig":         libkb.S{Val: sig},
		},
	})
	if err != nil {
		return err
	}
	return nil
}
