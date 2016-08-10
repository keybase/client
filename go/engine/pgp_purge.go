// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// PGPPurge is an engine.
type PGPPurge struct {
	libkb.Contextified
	arg       keybase1.PGPPurgeArg
	me        *libkb.User
	filenames []string
}

// NewPGPPurge creates a PGPPurge engine.
func NewPGPPurge(g *libkb.GlobalContext, arg keybase1.PGPPurgeArg) *PGPPurge {
	return &PGPPurge{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *PGPPurge) Name() string {
	return "PGPPurge"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPPurge) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PGPPurge) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPPurge) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&SaltpackEncrypt{},
	}
}

// Run starts the engine.
func (e *PGPPurge) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(e.G()))
	if err != nil {
		return err
	}
	e.me = me

	for _, bundle := range e.me.GetActivePGPKeys(false) {
		if err := e.export(ctx, bundle); err != nil {
			return err
		}
	}

	return nil
}

// KeyFiles returns the filenames of the exported keys.
func (e *PGPPurge) KeyFiles() []string {
	return e.filenames
}

func (e *PGPPurge) export(ctx *Context, bundle *libkb.PGPKeyBundle) error {
	skb, key, err := e.findAndUnlock(bundle)
	if err != nil {
		return err
	}
	if key == nil {
		return nil
	}

	filename := filepath.Join(e.G().Env.GetConfigDir(), key.GetFingerprint().String()+".sp")
	if err := e.encryptToFile(ctx, key, filename); err != nil {
		return err
	}

	if e.arg.DoPurge {
		e.G().Log.Debug("Removing PGP Key %s from keyring", key.GetFingerprint())
		if err := libkb.RemoveSKBFromKeyring(e.G(), skb); err != nil {
			return err
		}
	}

	e.filenames = append(e.filenames, filename)
	return nil
}

func (e *PGPPurge) findAndUnlock(bundle *libkb.PGPKeyBundle) (*libkb.SKB, *libkb.PGPKeyBundle, error) {
	arg := libkb.SecretKeyArg{
		Me:       e.me,
		KeyType:  libkb.PGPKeyType,
		KeyQuery: bundle.GetFingerprint().String(),
	}
	var skb *libkb.SKB
	var err error
	aerr := e.G().LoginState().Account(func(a *libkb.Account) {
		skb, err = a.LockedLocalSecretKey(arg)
	}, "PGPPurge - export")
	if aerr != nil {
		return nil, nil, aerr
	}
	if err != nil {
		return nil, nil, err
	}
	if skb == nil {
		return nil, nil, nil
	}

	secretRetriever := libkb.NewSecretStore(e.G(), e.me.GetNormalizedName())
	// the whole point of this is that these keys are unlockable without a prompt
	// so this should suffice:
	gk, err := skb.UnlockNoPrompt(nil, secretRetriever)
	if err != nil {
		return nil, nil, err
	}
	pk, ok := gk.(*libkb.PGPKeyBundle)
	if !ok {
		return nil, nil, fmt.Errorf("unlocked key incorrect type")
	}
	return skb, pk, nil
}

func (e *PGPPurge) encryptToFile(ctx *Context, bundle *libkb.PGPKeyBundle, filename string) error {
	out, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer out.Close()

	var buf bytes.Buffer
	if err := bundle.EncodeToStream(libkb.NopWriteCloser{W: &buf}, true); err != nil {
		return err
	}

	arg := &SaltpackEncryptArg{
		Source: &buf,
		Sink:   out,
	}
	eng := NewSaltpackEncrypt(arg, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	return nil
}
