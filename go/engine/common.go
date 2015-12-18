// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

func IsLoggedIn(e Engine, ctx *Context) (bool, error) {
	if ctx.LoginContext != nil {
		return ctx.LoginContext.LoggedInLoad()
	}
	return e.G().LoginState().LoggedInLoad()
}

func IsProvisioned(e Engine, ctx *Context) (bool, error) {
	if ctx.LoginContext != nil {
		return ctx.LoginContext.LoggedInProvisionedLoad()
	}
	return e.G().LoginState().LoggedInProvisionedLoad()
}

type keypair struct {
	encKey libkb.GenericKey
	sigKey libkb.GenericKey
}

// findPaperKeys checks if the user has paper backup keys.  If he/she
// does, it prompts for a paperkey phrase.  This is used to
// regenerate paper keys, which are then matched against the
// paper keys found in the keyfamily.
func findPaperKeys(ctx *Context, g *libkb.GlobalContext, me *libkb.User) (*keypair, error) {
	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return nil, fmt.Errorf("no computed key infos")
	}
	bdevs := cki.PaperDevices()
	if len(bdevs) == 0 {
		return nil, libkb.NoPaperKeysError{}
	}

	passphrase, err := libkb.GetPaperKeyPassphrase(ctx.SecretUI, me.GetName())
	if err != nil {
		return nil, err
	}
	paperPhrase := libkb.NewPaperKeyPhrase(passphrase)
	version, err := paperPhrase.Version()
	if err != nil {
		return nil, err
	}
	if version != libkb.PaperKeyVersion {
		g.Log.Debug("paper version mismatch: generated paper key version = %d, libkb version = %d", version, libkb.PaperKeyVersion)
		return nil, libkb.KeyVersionError{}
	}

	bkarg := &PaperKeyGenArg{
		Passphrase: libkb.NewPaperKeyPhrase(passphrase),
		SkipPush:   true,
		Me:         me,
	}
	bkeng := NewPaperKeyGen(bkarg, g)
	if err := RunEngine(bkeng, ctx); err != nil {
		return nil, err
	}

	sigKey := bkeng.SigKey()
	encKey := bkeng.EncKey()

	var match bool
	ckf := me.GetComputedKeyFamily()
	for _, bdev := range bdevs {
		sk, err := ckf.GetSibkeyForDevice(bdev.ID)
		if err != nil {
			continue
		}
		ek, err := ckf.GetEncryptionSubkeyForDevice(bdev.ID)
		if err != nil {
			continue
		}

		if sk.GetKID().Equal(sigKey.GetKID()) && ek.GetKID().Equal(encKey.GetKID()) {
			match = true
			break
		}
	}

	if !match {
		return nil, libkb.PassphraseError{Msg: "no matching paper backup keys found"}
	}

	return &keypair{sigKey: sigKey, encKey: encKey}, nil
}

// fetchLKS gets the encrypted LKS client half from the server.
// It uses encKey to decrypt it.  It also returns the passphrase
// generation.
func fetchLKS(ctx *Context, g *libkb.GlobalContext, encKey libkb.GenericKey) (libkb.PassphraseGeneration, []byte, error) {
	arg := libkb.APIArg{
		Endpoint:    "passphrase/recover",
		NeedSession: true,
		Args: libkb.HTTPArgs{
			"kid": encKey.GetKID(),
		},
	}
	if ctx.LoginContext != nil {
		arg.SessionR = ctx.LoginContext.LocalSession()
	}
	res, err := g.API.Get(arg)
	if err != nil {
		return 0, nil, err
	}
	ctext, err := res.Body.AtKey("ctext").GetString()
	if err != nil {
		return 0, nil, err
	}
	ppGen, err := res.Body.AtKey("passphrase_generation").GetInt()
	if err != nil {
		return 0, nil, err
	}

	//  Now try to decrypt with the unlocked device key
	msg, _, err := encKey.DecryptFromString(ctext)
	if err != nil {
		return 0, nil, err
	}

	return libkb.PassphraseGeneration(ppGen), msg, nil
}
