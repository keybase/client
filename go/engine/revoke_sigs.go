// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type RevokeSigsEngine struct {
	libkb.Contextified
	sigIDQueries []string
}

func NewRevokeSigsEngine(g *libkb.GlobalContext, sigIDQueries []string) *RevokeSigsEngine {
	return &RevokeSigsEngine{
		sigIDQueries: sigIDQueries,
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
	ret := make([]keybase1.SigID, len(e.sigIDQueries))
	for i, query := range e.sigIDQueries {
		if len(query) < keybase1.SigIDQueryMin {
			return nil, errors.New("sigID query too short")
		}
		sigID, err := me.SigIDSearch(query)
		if err != nil {
			return nil, err
		}
		ret[i] = sigID
	}
	return ret, nil
}

func (e *RevokeSigsEngine) Run(m libkb.MetaContext) error {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "RevokeSigsEngine")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "RevokeSigsEngine")

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return err
	}

	sigIDsToRevoke, err := e.getSigIDsToRevoke(me)
	if err != nil {
		return err
	}

	lease, merkleRoot, err := libkb.RequestDowngradeLeaseBySigIDs(m.Ctx(), m.G(), sigIDsToRevoke)
	if err != nil {
		return err
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	sigKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(ska, "to revoke a signature"))
	if err != nil {
		return err
	}
	if sigKey == nil {
		return fmt.Errorf("Revocation signing key is nil.")
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}
	proof, err := me.RevokeSigsProof(sigKey, sigIDsToRevoke, merkleRoot)
	if err != nil {
		return err
	}
	sig, _, _, err := libkb.SignJSON(proof, sigKey)
	if err != nil {
		return err
	}
	kid := sigKey.GetKID()
	_, err = m.G().API.Post(libkb.APIArg{
		Endpoint:    "sig/revoke",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"signing_kid":        libkb.S{Val: kid.String()},
			"sig":                libkb.S{Val: sig},
			"downgrade_lease_id": libkb.S{Val: string(lease.LeaseID)},
		},
		NetContext: m.Ctx(),
	})
	if err != nil {
		return err
	}

	return nil
}
