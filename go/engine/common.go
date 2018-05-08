// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// IsLoggedInWithError conveys if the user is in a logged-in state or not.
// If this function returns `true`, it's because the user is logged in,
// is on a provisioned device, and has an unlocked device key, If this
// function returns `false`, it's because either no one has ever logged onto
// this device, or someone has, and then clicked `logout`. If the return
// value is `false`, and `err` is `nil`, then the service is in one of
// those expected "logged out" states.  If the return value is `false`
// and `err` is non-`nil`, then something went wrong, and the app is in some
// sort of unexpected state. If `ret` is `true`, then `uid` will convey
// which user is logged in.
//
// Under the hood, IsLoggedIn is going through the BootstrapActiveDevice
// flow and therefore will try its best to unlocked locked keys if it can
// without user interaction.

type keypair struct {
	encKey libkb.GenericKey
	sigKey libkb.GenericKey
}

// findDeviceKeys looks for device keys and unlocks them.
func findDeviceKeys(m libkb.MetaContext, me *libkb.User) (*keypair, error) {
	// need to be logged in to get a device key (unlocked)
	lin, _ := isLoggedIn(m)
	if !lin {
		return nil, libkb.LoginRequiredError{}
	}

	// Get unlocked device for decryption and signing
	// passing in nil SecretUI since we don't know the passphrase.
	m.CDebugf("findDeviceKeys: getting device encryption key")
	parg := libkb.SecretKeyPromptArg{
		Ska: libkb.SecretKeyArg{
			Me:      me,
			KeyType: libkb.DeviceEncryptionKeyType,
		},
		Reason: "change passphrase",
	}
	encKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, parg)
	if err != nil {
		return nil, err
	}
	m.CDebugf("findDeviceKeys: got device encryption key")
	m.CDebugf("findDeviceKeys: getting device signing key")
	parg.Ska.KeyType = libkb.DeviceSigningKeyType
	sigKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, parg)
	if err != nil {
		return nil, err
	}
	m.CDebugf("findDeviceKeys: got device signing key")

	return &keypair{encKey: encKey, sigKey: sigKey}, nil
}

// findPaperKeys checks if the user has paper backup keys.  If he/she
// does, it prompts for a paperkey phrase.  This is used to
// regenerate paper keys, which are then matched against the
// paper keys found in the keyfamily.
func findPaperKeys(m libkb.MetaContext, me *libkb.User) (*keypair, error) {
	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return nil, fmt.Errorf("no computed key infos")
	}
	bdevs := cki.PaperDevices()
	if len(bdevs) == 0 {
		return nil, libkb.NoPaperKeysError{}
	}

	passphrase, err := libkb.GetPaperKeyPassphrase(m, m.UIs().SecretUI, me.GetName(), nil)
	if err != nil {
		return nil, err
	}

	return matchPaperKey(m, me, passphrase)
}

// matchPaperKey checks to make sure paper is a valid paper phrase and that it exists
// in the user's keyfamily.
func matchPaperKey(m libkb.MetaContext, me *libkb.User, paper string) (*keypair, error) {
	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return nil, fmt.Errorf("no computed key infos")
	}
	bdevs := cki.PaperDevices()
	if len(bdevs) == 0 {
		return nil, libkb.NoPaperKeysError{}
	}

	pc := new(libkb.PaperChecker)
	if err := pc.Check(m, paper); err != nil {
		return nil, err
	}

	// phrase has the correct version and contains valid words

	paperPhrase := libkb.NewPaperKeyPhrase(paper)

	bkarg := &PaperKeyGenArg{
		Passphrase: paperPhrase,
		SkipPush:   true,
		Me:         me,
	}
	bkeng := NewPaperKeyGen(m.G(), bkarg)
	if err := RunEngine2(m, bkeng); err != nil {
		return nil, err
	}

	sigKey := bkeng.SigKey()
	encKey := bkeng.EncKey()

	m.CDebugf("generated paper key signing kid: %s", sigKey.GetKID())
	m.CDebugf("generated paper key encryption kid: %s", encKey.GetKID())

	var match bool
	ckf := me.GetComputedKeyFamily()
	for _, bdev := range bdevs {
		sk, err := ckf.GetSibkeyForDevice(bdev.ID)
		if err != nil {
			m.CDebugf("ckf.GetSibkeyForDevice(%s) error: %s", bdev.ID, err)
			continue
		}
		m.CDebugf("paper key device %s signing kid: %s", bdev.ID, sk.GetKID())
		ek, err := ckf.GetEncryptionSubkeyForDevice(bdev.ID)
		if err != nil {
			m.CDebugf("ckf.GetEncryptionSubkeyForDevice(%s) error: %s", bdev.ID, err)
			continue
		}
		m.CDebugf("paper key device %s encryption kid: %s", bdev.ID, ek.GetKID())

		if sk.GetKID().Equal(sigKey.GetKID()) && ek.GetKID().Equal(encKey.GetKID()) {
			m.CDebugf("paper key device %s matches generated paper key", bdev.ID)
			match = true
			break
		}

		m.CDebugf("paper key device %s does not match generated paper key", bdev.ID)
	}

	if !match {
		m.CDebugf("no matching paper keys found")
		return nil, libkb.PassphraseError{Msg: "no matching paper backup keys found"}
	}

	return &keypair{sigKey: sigKey, encKey: encKey}, nil
}

// fetchLKS gets the encrypted LKS client half from the server.
// It uses encKey to decrypt it.  It also returns the passphrase
// generation.
func fetchLKS(m libkb.MetaContext, encKey libkb.GenericKey) (libkb.PassphraseGeneration, libkb.LKSecClientHalf, error) {
	arg := libkb.APIArg{
		Endpoint:    "passphrase/recover",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"kid": encKey.GetKID(),
		},
	}
	if lctx := m.LoginContext(); lctx != nil {
		arg.SessionR = lctx.LocalSession()
	}
	res, err := m.G().API.Get(arg)
	var dummy libkb.LKSecClientHalf
	if err != nil {
		return 0, dummy, err
	}
	ctext, err := res.Body.AtKey("ctext").GetString()
	if err != nil {
		return 0, dummy, err
	}
	ppGen, err := res.Body.AtKey("passphrase_generation").GetInt()
	if err != nil {
		return 0, dummy, err
	}

	// Now try to decrypt with the unlocked device key
	msg, _, err := encKey.DecryptFromString(ctext)
	if err != nil {
		return 0, dummy, err
	}
	clientHalf, err := libkb.NewLKSecClientHalfFromBytes(msg)
	if err != nil {
		return 0, dummy, err
	}

	return libkb.PassphraseGeneration(ppGen), clientHalf, nil
}
