// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This engine makes sure the user is logged in and unlocked.
// It asks for a paper key if need be. It does not ask for a passphrase.

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
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
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

	kp, err := findDeviceKeys(ctx, e, me)
	if err == nil {
		// Device keys are unlocked. Just log in with them.
		e.G().Log.Debug("Logging in with unlocked device key")
		err = e.G().LoginState().LoginWithKey(ctx.LoginContext, me, kp.sigKey, nil)
		return err
	}

	// Prompts for a paper key.
	e.G().Log.Debug("No device keys available; getting paper key")
	kp, err = findPaperKeys(ctx, e.G(), me)
	if err != nil {
		return err
	}

	e.G().Log.Debug("Logging in")
	err = e.G().LoginState().LoginWithKey(ctx.LoginContext, me, kp.sigKey, func(lctx libkb.LoginContext) error {
		// Now we're logged in.
		e.G().Log.Debug("Logged in")
		ctx.LoginContext = lctx

		// Get the LKS client half.
		gen, clientLKS, err := fetchLKS(ctx, e.G(), kp.encKey)
		if err != nil {
			return err
		}
		lks := libkb.NewLKSecWithClientHalf(clientLKS, gen, me.GetUID(), e.G())
		e.G().Log.Debug("Got LKS client half")

		// Get the LKS server half.
		err = lks.Load(lctx)
		if err != nil {
			return err
		}
		e.G().Log.Debug("Got LKS full")

		secretStore := libkb.NewSecretStore(e.G(), me.GetNormalizedName())
		e.G().Log.Debug("Got secret store")

		// Extract the LKS secret
		secret, err := lks.GetSecret(lctx)
		if err != nil {
			return err
		}
		e.G().Log.Debug("Got LKS secret")

		err = secretStore.StoreSecret(secret)
		if err != nil {
			return err
		}
		e.G().Log.Debug("Stored secret with LKS from paperky")

		// This could prompt but shouldn't because of the secret store.
		err = e.unlockDeviceKeys(ctx, me)
		if err != nil {
			return err
		}
		e.G().Log.Debug("Unlocked device keys")

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
