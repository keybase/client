// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is the main login engine.

package engine

import "github.com/keybase/client/go/libkb"

// LoginWithPaperKey is an engine.
type LoginWithPaperKey struct {
	libkb.Contextified
}

// NewLoginWithPaperKey creates a LoginWithPaperKey engine.
// Uses the paperkey to log in and unlock LKS.
func NewLoginWithPaperKey(g *libkb.GlobalContext) *LoginWithPaperKey {
	return &LoginWithPaperKey{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *LoginWithPaperKey) Name() string {
	return "LoginWithPaperKey"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginWithPaperKey) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginWithPaperKey) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginWithPaperKey) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *LoginWithPaperKey) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserForceArg(e.G()))
	if err != nil {
		return err
	}

	// Prompts for a paper key.
	kp, err := findPaperKeys(ctx, e.G(), me)
	if err != nil {
		return err
	}

	// TODO remove me.
	// err = e.G().LoginState().LoginWithKey(ctx.LoginContext, me, kp.sigKey, nil)
	// if err != nil {
	// 	return err
	// }

	err = e.G().LoginState().LoginWithKey(ctx.LoginContext, me, kp.sigKey, func(lctx libkb.LoginContext) error {
		ctx.LoginContext = lctx
		gen, clientLKS, err := fetchLKS(ctx, e.G(), kp.encKey)
		_ = gen
		_ = clientLKS
		if err != nil {
			return err
		}

		// e.lks = libkb.NewLKSecWithClientHalf(clientLKS, gen, e.arg.User.GetUID(), e.G())

		// saveToSecretStore(e.G(), lctx, e.arg.User.GetNormalizedName(), e.lks)

		err = e.unlockDeviceKeys(ctx, me)
		if err != nil {
			return err
		}

		return nil
	})

	return err
}

func (e *LoginWithPaperKey) unlockDeviceKeys(ctx *Context, me *libkb.User) error {

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	_, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "unlock device keys"))
	if err != nil {
		return err
	}
	ska.KeyType = libkb.DeviceEncryptionKeyType
	_, err = e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "unlock device keys"))
	if err != nil {
		return err
	}

	return nil
}
