// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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

func (c *CryptoHandler) SignED25519(_ context.Context, arg keybase1.SignED25519Arg) (keybase1.ED25519SignatureInfo, error) {
	return engine.SignED25519(c.G(), c.getSecretUI(arg.SessionID, arg.Reason), arg)
}

func (c *CryptoHandler) SignToString(_ context.Context, arg keybase1.SignToStringArg) (string, error) {
	return engine.SignToString(c.G(), c.getSecretUI(arg.SessionID, arg.Reason), arg)
}

func (c *CryptoHandler) UnboxBytes32(_ context.Context, arg keybase1.UnboxBytes32Arg) (keybase1.Bytes32, error) {
	return engine.UnboxBytes32(c.G(), c.getSecretUI(arg.SessionID, arg.Reason), arg)
}

func (c *CryptoHandler) UnboxBytes32Any(_ context.Context, arg keybase1.UnboxBytes32AnyArg) (keybase1.UnboxAnyRes, error) {
	return engine.UnboxBytes32Any(c.G(), c.getSecretUI(arg.SessionID, arg.Reason), arg)
}
