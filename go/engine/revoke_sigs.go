package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type RevokeSigsEngine struct {
	libkb.Contextified
	sigIDs []keybase1.SigID
	seqnos []int
}

func NewRevokeSigsEngine(sigIDs []keybase1.SigID, seqnos []int, g *libkb.GlobalContext) *RevokeSigsEngine {
	return &RevokeSigsEngine{
		sigIDs:       sigIDs,
		seqnos:       seqnos,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *RevokeSigsEngine) Name() string {
	return "RevokeSigs"
}

func (e *RevokeSigsEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
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
	for _, seqno := range e.seqnos {
		sigID := me.GetSigIDFromSeqno(seqno)
		if sigID.IsNil() {
			return nil, fmt.Errorf("Sequence number %d did not correspond to any signature.", seqno)
		}
		ret = append(ret, sigID)
	}
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
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}

	sigIDsToRevoke, err := e.getSigIDsToRevoke(me)
	if err != nil {
		return err
	}

	sigKey, _, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceKeyType,
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
	sig, _, _, err := libkb.SignJson(proof, sigKey)
	if err != nil {
		return err
	}
	kid := sigKey.GetKid()
	_, err = e.G().API.Post(libkb.ApiArg{
		Endpoint:    "sig/revoke",
		NeedSession: true,
		Args: libkb.HttpArgs{
			"signing_kid": libkb.S{Val: kid.String()},
			"sig":         libkb.S{Val: sig},
		},
	})
	if err != nil {
		return err
	}
	return nil
}
