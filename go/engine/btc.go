// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type BTCEngine struct {
	libkb.Contextified
	address string
	force   bool
}

func NewBTCEngine(address string, force bool, g *libkb.GlobalContext) *BTCEngine {
	return &BTCEngine{
		address:      address,
		force:        force,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *BTCEngine) Name() string {
	return "BTC"
}

func (e *BTCEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *BTCEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *BTCEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *BTCEngine) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ BTCEngine Run")
	defer func() {
		e.G().Log.Debug("- BTCEngine Run")
	}()
	_, _, err = libkb.BtcAddrCheck(e.address, nil)
	if err != nil {
		return err
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	cryptocurrencyLink := me.IDTable().ActiveCryptocurrency()
	if cryptocurrencyLink != nil && !e.force {
		return fmt.Errorf("User already has a cryptocurrency address. To overwrite, use --force.")
	}
	var sigIDToRevoke keybase1.SigID
	if cryptocurrencyLink != nil {
		sigIDToRevoke = cryptocurrencyLink.GetSigID()
	}

	sigKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}, ctx.SecretUI, "to register a cryptocurrency address")
	if err != nil {
		return err
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}

	claim, err := me.CryptocurrencySig(sigKey, e.address, sigIDToRevoke)
	if err != nil {
		return err
	}
	sig, _, _, err := libkb.SignJSON(claim, sigKey)
	if err != nil {
		return err
	}
	kid := sigKey.GetKID()
	_, err = e.G().API.Post(libkb.APIArg{
		Endpoint:    "sig/post",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"sig":             libkb.S{Val: sig},
			"signing_kid":     libkb.S{Val: kid.String()},
			"is_remote_proof": libkb.B{Val: false},
			"type":            libkb.S{Val: "cryptocurrency"},
		},
	})
	if err != nil {
		return err
	}
	return nil
}
