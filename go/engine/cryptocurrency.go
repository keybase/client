// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CryptocurrencyEngine struct {
	libkb.Contextified
	arg keybase1.RegisterAddressArg
	res keybase1.RegisterAddressRes
}

func NewCryptocurrencyEngine(g *libkb.GlobalContext, arg keybase1.RegisterAddressArg) *CryptocurrencyEngine {
	return &CryptocurrencyEngine{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

func (e *CryptocurrencyEngine) Name() string {
	return "Cryptocurrency"
}

func (e *CryptocurrencyEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *CryptocurrencyEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *CryptocurrencyEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *CryptocurrencyEngine) Run(ctx *Context) (err error) {
	defer e.G().Trace("CryptocurrencyEngine", func() error { return err })()

	var typ libkb.CryptocurrencyType
	typ, _, err = libkb.CryptocurrencyParseAndCheck(e.arg.Address)

	if err != nil {
		return libkb.InvalidAddressError{Msg: err.Error()}
	}

	family := typ.ToCryptocurrencyFamily()
	if len(e.arg.WantedFamily) > 0 && e.arg.WantedFamily != string(family) {
		return libkb.InvalidAddressError{Msg: fmt.Sprintf("wanted coin type %q, but got %q", e.arg.WantedFamily, family)}
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	cryptocurrencyLink := me.IDTable().ActiveCryptocurrency(typ.ToCryptocurrencyFamily())
	if cryptocurrencyLink != nil && !e.arg.Force {
		return libkb.ExistsError{Msg: string(family)}
	}
	var sigIDToRevoke keybase1.SigID
	if cryptocurrencyLink != nil {
		sigIDToRevoke = cryptocurrencyLink.GetSigID()
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	sigKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "to register a cryptocurrency address"))
	if err != nil {
		return err
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}

	claim, err := me.CryptocurrencySig(sigKey, e.arg.Address, typ, sigIDToRevoke)
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
		SessionType: libkb.APISessionTypeREQUIRED,
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

	e.res.Family = string(family)
	e.res.Type = typ.String()

	return nil
}

func (e *CryptocurrencyEngine) Result() keybase1.RegisterAddressRes {
	return e.res
}
