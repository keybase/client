// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type CryptoHandler struct {
	libkb.Contextified
}

func NewCryptoHandler(xp rpc.Transporter, g *libkb.GlobalContext) *CryptoHandler {
	return &CryptoHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CryptoHandler) getDelegatedSecretUI() libkb.SecretUI {
	if c.G().UIRouter == nil {
		c.G().Log.Debug("no UIRouter to get SecretUI from")
		return nil
	}

	ui, err := c.G().UIRouter.GetSecretUI()
	if err != nil {
		c.G().Log.Debug("UIRouter.GetSecretUI() returned %v", err)
		return nil
	}

	if ui == nil {
		c.G().Log.Debug("UIRouter.GetSecretUI() returned nil")
	}

	return ui
}

type secretUIError struct{}

func (secretUIError) Error() string {
	return "Cannot fulfill SecretUI method"
}

// A libkb.SecretUI implementation that always returns an error.
type errorSecretUI struct{}

var _ libkb.SecretUI = errorSecretUI{}

func (errorSecretUI) GetSecret(keybase1.SecretEntryArg, *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	return nil, secretUIError{}
}

func (errorSecretUI) GetNewPassphrase(keybase1.GetNewPassphraseArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, secretUIError{}
}

func (errorSecretUI) GetKeybasePassphrase(keybase1.GetKeybasePassphraseArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, secretUIError{}
}

func (errorSecretUI) GetPaperKeyPassphrase(keybase1.GetPaperKeyPassphraseArg) (string, error) {
	return "", secretUIError{}
}

func (errorSecretUI) GetPassphrase(keybase1.GUIEntryArg, *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, secretUIError{}
}

func (c *CryptoHandler) getSecretUI() libkb.SecretUI {
	secretUI := c.getDelegatedSecretUI()
	if secretUI != nil {
		return secretUI
	}

	return errorSecretUI{}
}

// TODO: Remove sessionID from args.

func (c *CryptoHandler) SignED25519(_ context.Context, arg keybase1.SignED25519Arg) (keybase1.ED25519SignatureInfo, error) {
	return engine.SignED25519(c.G(), c.getSecretUI(), arg)
}

func (c *CryptoHandler) SignToString(_ context.Context, arg keybase1.SignToStringArg) (string, error) {
	return engine.SignToString(c.G(), c.getSecretUI(), arg)
}

func (c *CryptoHandler) UnboxBytes32(_ context.Context, arg keybase1.UnboxBytes32Arg) (keybase1.Bytes32, error) {
	return engine.UnboxBytes32(c.G(), c.getSecretUI(), arg)
}
