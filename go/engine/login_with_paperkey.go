// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
	m := NewMetaContext(e, ctx)
	me, err := libkb.LoadMe(libkb.NewLoadUserForceArg(e.G()))
	if err != nil {
		return err
	}

	kp, err := findDeviceKeys(ctx, e, me)
	mctx := NewMetaContext(e, ctx)
	if err == nil {
		// Device keys are unlocked. Just log in with them.
		m.CDebugf("Logging in with unlocked device key")
		err = e.G().LoginState().LoginWithKey(mctx, me, kp.sigKey, nil)
		return err
	}

	// Prompts for a paper key.
	m.CDebugf("No device keys available; getting paper key")
	kp, err = findPaperKeys(m, ctx, me)
	if err != nil {
		return err
	}

	m.CDebugf("Logging in")
	err = m.G().LoginState().LoginWithKey(mctx, me, kp.sigKey, func(lctx libkb.LoginContext) error {
		// Now we're logged in.
		m = m.WithLoginContext(lctx)
		m.CDebugf("Logged in")
		ctx.LoginContext = lctx

		// Get the LKS client half.
		gen, clientLKS, err := fetchLKS(ctx, e.G(), kp.encKey)
		if err != nil {
			return err
		}
		lks := libkb.NewLKSecWithClientHalf(clientLKS, gen, me.GetUID(), e.G())
		m.CDebugf("Got LKS client half")

		// Get the LKS server half.
		err = lks.Load(m)
		if err != nil {
			return err
		}
		m.CDebugf("Got LKS full")

		secretStore := libkb.NewSecretStore(e.G(), me.GetNormalizedName())
		m.CDebugf("Got secret store")

		// Extract the LKS secret
		secret, err := lks.GetSecret(m)
		if err != nil {
			return err
		}
		m.CDebugf("Got LKS secret")

		err = secretStore.StoreSecret(secret)
		if err != nil {
			return err
		}
		m.CDebugf("Stored secret with LKS from paperkey")

		// This could prompt but shouldn't because of the secret store.
		err = e.unlockDeviceKeys(m, ctx, me)
		if err != nil {
			return err
		}
		m.CDebugf("Unlocked device keys")

		return nil
	})
	if err != nil {
		return err
	}

	e.G().Log.Debug("LoginWithPaperkey success, sending login notification")
	e.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
	e.G().Log.Debug("LoginWithPaperkey success, calling login hooks")
	e.G().CallLoginHooks()

	return nil
}

func (e *LoginWithPaperKey) unlockDeviceKeys(m libkb.MetaContext, ctx *Context, me *libkb.User) error {
	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	_, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, ctx.SecretKeyPromptArg(ska, "unlock device keys"))
	if err != nil {
		return err
	}
	ska.KeyType = libkb.DeviceEncryptionKeyType
	_, err = m.G().Keyrings.GetSecretKeyWithPrompt(m, ctx.SecretKeyPromptArg(ska, "unlock device keys"))
	if err != nil {
		return err
	}

	return nil
}
