// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CryptoHandler struct {
	libkb.Contextified
}

func NewCryptoHandler(g *libkb.GlobalContext) *CryptoHandler {
	return &CryptoHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CryptoHandler) getDelegatedSecretUI(sessionID int) libkb.SecretUI {
	// We should only ever be called in service mode, so UIRouter
	// should be non-nil.

	// sessionID 0 is special for desktop UI and should be used in this
	// situation for one-off passphrase requests.
	ui, err := c.G().UIRouter.GetSecretUI(0)
	if err != nil {
		c.G().Log.Debug("UIRouter.GetSecretUI() returned an error %v", err)
		return nil
	}

	if ui == nil {
		c.G().Log.Debug("UIRouter.GetSecretUI() returned nil")
	}

	c.G().Log.Debug("CryptoHandler: using delegated SecretUI")

	return ui
}

// A libkb.SecretUI implementation that always returns a LoginRequiredError.
type errorSecretUI struct {
	reason string
}

var _ libkb.SecretUI = errorSecretUI{}

func (e errorSecretUI) GetPassphrase(keybase1.GUIEntryArg, *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, libkb.LoginRequiredError{Context: e.reason}
}

func (c *CryptoHandler) getSecretUI(sessionID int, reason string) libkb.SecretUI {
	secretUI := c.getDelegatedSecretUI(sessionID)
	if secretUI != nil {
		return secretUI
	}

	// Return an errorSecretUI instead of triggering an error
	// since we may not need a SecretUI at all.
	return errorSecretUI{reason}
}

func (c *CryptoHandler) secretUIMaker(sessionID int, reason string) func() libkb.SecretUI {
	f := func() libkb.SecretUI {
		return c.getSecretUI(sessionID, reason)
	}
	return f
}

func (c *CryptoHandler) SignED25519(ctx context.Context, arg keybase1.SignED25519Arg) (keybase1.ED25519SignatureInfo, error) {
	return engine.SignED25519(ctx, c.G(), c.secretUIMaker(arg.SessionID, arg.Reason), arg)
}

func (c *CryptoHandler) SignED25519ForKBFS(ctx context.Context, arg keybase1.SignED25519ForKBFSArg) (keybase1.ED25519SignatureInfo, error) {
	return engine.SignED25519ForKBFS(ctx, c.G(), c.secretUIMaker(arg.SessionID, arg.Reason), arg)
}

func (c *CryptoHandler) SignToString(ctx context.Context, arg keybase1.SignToStringArg) (string, error) {
	return engine.SignToString(ctx, c.G(), c.secretUIMaker(arg.SessionID, arg.Reason), arg)
}

func (c *CryptoHandler) UnboxBytes32(ctx context.Context, arg keybase1.UnboxBytes32Arg) (keybase1.Bytes32, error) {
	return engine.UnboxBytes32(ctx, c.G(), c.secretUIMaker(arg.SessionID, arg.Reason), arg)
}

func (c *CryptoHandler) UnboxBytes32Any(ctx context.Context, arg keybase1.UnboxBytes32AnyArg) (keybase1.UnboxAnyRes, error) {
	return engine.UnboxBytes32Any(ctx, c.G(), c.secretUIMaker(arg.SessionID, arg.Reason), arg)
}
