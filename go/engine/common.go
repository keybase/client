// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func IsLoggedIn(e Engine, ctx *Context) (ret bool, uid keybase1.UID, err error) {
	var lih libkb.LoggedInHelper
	if lih = ctx.LoginContext; lih == nil {
		lih = e.G().LoginState()
	}
	ret, err = lih.LoggedInLoad()
	if ret && err == nil {
		uid = lih.GetUID()
	}
	return ret, uid, err
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

	passphrase, err := libkb.GetPaperKeyPassphrase(g, ctx.SecretUI, me.GetName())
	if err != nil {
		return nil, err
	}

	return matchPaperKey(ctx, g, me, passphrase)
}

// matchPaperKey checks to make sure paper is a valid paper phrase and that it exists
// in the user's keyfamily.
func matchPaperKey(ctx *Context, g *libkb.GlobalContext, me *libkb.User, paper string) (*keypair, error) {
	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return nil, fmt.Errorf("no computed key infos")
	}
	bdevs := cki.PaperDevices()
	if len(bdevs) == 0 {
		return nil, libkb.NoPaperKeysError{}
	}

	pc := new(libkb.PaperChecker)
	if err := pc.Check(g, paper); err != nil {
		return nil, err
	}

	// phrase has the correct version and contains valid words

	paperPhrase := libkb.NewPaperKeyPhrase(paper)

	bkarg := &PaperKeyGenArg{
		Passphrase: paperPhrase,
		SkipPush:   true,
		Me:         me,
	}
	bkeng := NewPaperKeyGen(bkarg, g)
	if err := RunEngine(bkeng, ctx); err != nil {
		return nil, err
	}

	sigKey := bkeng.SigKey()
	encKey := bkeng.EncKey()

	g.Log.Debug("generated paper key signing kid: %s", sigKey.GetKID())
	g.Log.Debug("generated paper key encryption kid: %s", encKey.GetKID())

	var match bool
	ckf := me.GetComputedKeyFamily()
	for _, bdev := range bdevs {
		sk, err := ckf.GetSibkeyForDevice(bdev.ID)
		if err != nil {
			g.Log.Debug("ckf.GetSibkeyForDevice(%s) error: %s", bdev.ID, err)
			continue
		}
		g.Log.Debug("paper key device %s signing kid: %s", bdev.ID, sk.GetKID())
		ek, err := ckf.GetEncryptionSubkeyForDevice(bdev.ID)
		if err != nil {
			g.Log.Debug("ckf.GetEncryptionSubkeyForDevice(%s) error: %s", bdev.ID, err)
			continue
		}
		g.Log.Debug("paper key device %s encryption kid: %s", bdev.ID, ek.GetKID())

		if sk.GetKID().Equal(sigKey.GetKID()) && ek.GetKID().Equal(encKey.GetKID()) {
			g.Log.Debug("paper key device %s matches generated paper key", bdev.ID)
			match = true
			break
		}

		g.Log.Debug("paper key device %s does not match generated paper key", bdev.ID)
	}

	if !match {
		g.Log.Debug("no matching paper keys found")
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
