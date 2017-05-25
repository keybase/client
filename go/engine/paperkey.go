// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PaperKey creates paper backup keys for a user and pushes them to the server.
// It checks for existing paper devices and offers to revoke the
// keys.
//

package engine

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// PaperKey is an engine.
type PaperKey struct {
	passphrase libkb.PaperKeyPhrase
	gen        *PaperKeyGen
	libkb.Contextified
}

// NewPaperKey creates a PaperKey engine.
func NewPaperKey(g *libkb.GlobalContext) *PaperKey {
	return &PaperKey{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PaperKey) Name() string {
	return "PaperKey"
}

// GetPrereqs returns the engine prereqs.
func (e *PaperKey) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PaperKey) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PaperKey) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&RevokeEngine{},
		&PaperKeyGen{},
	}
}

// Run starts the engine.
func (e *PaperKey) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	// check for existing paper keys
	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return fmt.Errorf("no computed key infos")
	}

	var needReload bool
	var devicesToRevoke []*libkb.Device
	for i, bdev := range cki.PaperDevices() {
		revoke, err := ctx.LoginUI.PromptRevokePaperKeys(context.TODO(),
			keybase1.PromptRevokePaperKeysArg{
				Device: *bdev.ProtExport(),
				Index:  i,
			})
		if err != nil {
			e.G().Log.Warning("prompt error: %s", err)
			return err
		}
		if revoke {
			devicesToRevoke = append(devicesToRevoke, bdev)
		}
	}

	// Revoke all keys at once, not one-by-one. This way, a cancelation of the
	// experience above will stop all operations
	for _, bdev := range devicesToRevoke {
		reng := NewRevokeDeviceEngine(RevokeDeviceEngineArgs{ID: bdev.ID}, e.G())
		if err := RunEngine(reng, ctx); err != nil {
			// probably not a good idea to continue...
			return err
		}
		needReload = true
	}

	if needReload {
		me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
		if err != nil {
			return err
		}
	}

	ska1 := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	signingKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska1, "You must sign your new paper key"))
	if err != nil {
		return err
	}

	ska2 := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	encryptionKeyGeneric, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska2, "You must encrypt for your new paper key"))
	if err != nil {
		return err
	}
	encryptionKey, ok := encryptionKeyGeneric.(libkb.NaclDHKeyPair)
	if !ok {
		return fmt.Errorf("Unexpected encryption key type")
	}

	e.passphrase, err = libkb.MakePaperKeyPhrase(libkb.PaperKeyVersion)
	if err != nil {
		return err
	}

	kgarg := &PaperKeyGenArg{
		Passphrase:     e.passphrase,
		Me:             me,
		SigningKey:     signingKey,
		EncryptionKey:  encryptionKey,
		LoginContext:   nil,
		PerUserKeyring: nil,
	}
	e.gen = NewPaperKeyGen(kgarg, e.G())
	if err := RunEngine(e.gen, ctx); err != nil {
		return err
	}

	return ctx.LoginUI.DisplayPaperKeyPhrase(context.TODO(), keybase1.DisplayPaperKeyPhraseArg{Phrase: e.passphrase.String()})

}

func (e *PaperKey) Passphrase() string {
	return e.passphrase.String()
}

func (e *PaperKey) SigKey() libkb.GenericKey {
	return e.gen.SigKey()
}

func (e *PaperKey) EncKey() libkb.GenericKey {
	return e.gen.EncKey()
}
