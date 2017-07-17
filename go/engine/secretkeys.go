// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type SecretKeysEngine struct {
	libkb.Contextified
	result keybase1.SecretKeys
}

func NewSecretKeysEngine(g *libkb.GlobalContext) *SecretKeysEngine {
	return &SecretKeysEngine{
		Contextified: libkb.NewContextified(g),
	}
}

func (e *SecretKeysEngine) Name() string {
	return "SecretKey"
}

func (e *SecretKeysEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *SecretKeysEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *SecretKeysEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *SecretKeysEngine) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ SecretKeysEngine Run")

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	// Clear out all the cached secret key state. This forces a password prompt
	// below.
	e.G().LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
		a.ClearCachedSecretKeys()
		a.ClearKeyring()
	}, "clear stream cache")

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	sigKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "to revoke another key"))
	if err != nil {
		return err
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}
	sigNaclKey, ok := sigKey.(libkb.NaclSigningKeyPair)
	if !ok {
		return fmt.Errorf("Expected a NaCl signing key.")
	}
	e.G().Log.Debug("| got signing key")

	ska.KeyType = libkb.DeviceEncryptionKeyType
	encKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "to revoke another key"))
	if err != nil {
		return err
	}
	if err = encKey.CheckSecretKey(); err != nil {
		return err
	}
	encNaclKey, ok := encKey.(libkb.NaclDHKeyPair)
	if !ok {
		return fmt.Errorf("Expected a NaCl encryption key.")
	}
	e.G().Log.Debug("| got encryption key")

	e.result.Signing = [64]byte(*sigNaclKey.Private)
	e.result.Encryption = [32]byte(*encNaclKey.Private)

	return nil
}

func (e *SecretKeysEngine) Result() keybase1.SecretKeys {
	return e.result
}
