// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,!ios

package libkb

import (
	"encoding/base64"

	kc "github.com/keybase/go-osxkeychain"
)

type KeychainSecretStore struct {
	Contextified
	accountName NormalizedUsername
}

var _ SecretStore = KeychainSecretStore{}

func (k KeychainSecretStore) getServiceName() string {
	return k.G().Env.GetStoredSecretServiceName()
}

func (k KeychainSecretStore) StoreSecret(secret []byte) (err error) {
	k.G().Log.Debug("+ StoreSecret(%s, %d)", k.accountName, len(secret))
	defer func() {
		k.G().Log.Debug("- StoreSecret -> %s", ErrToOk(err))
	}()

	// base64-encode to make it easy to work with Keychain Access.
	encodedSecret := base64.StdEncoding.EncodeToString(secret)
	attributes := kc.GenericPasswordAttributes{
		ServiceName: k.getServiceName(),
		AccountName: k.accountName.String(),
		Password:    []byte(encodedSecret),
	}
	err = kc.RemoveAndAddGenericPassword(&attributes)
	return
}

func (k KeychainSecretStore) RetrieveSecret() (secret []byte, err error) {
	k.G().Log.Debug("+ RetrieveSecret(%s)", k.accountName)
	defer func() {
		k.G().Log.Debug("- RetrieveSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: k.getServiceName(),
		AccountName: k.accountName.String(),
	}

	encodedSecret, err := kc.FindGenericPassword(&attributes)
	if err != nil {
		return
	}

	secret, err = base64.StdEncoding.DecodeString(string(encodedSecret))
	if err != nil {
		secret = nil
	}

	return
}

func (k KeychainSecretStore) ClearSecret() (err error) {
	k.G().Log.Debug("+ ClearSecret(%s)", k.accountName)
	defer func() {
		k.G().Log.Debug("- ClearSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: k.getServiceName(),
		AccountName: k.accountName.String(),
	}

	err = kc.FindAndRemoveGenericPassword(&attributes)
	// Don't count the item not being found as an error.
	if err == kc.ErrItemNotFound {
		err = nil
	}
	return
}

func NewSecretStore(g *GlobalContext, username NormalizedUsername) SecretStore {
	return KeychainSecretStore{
		Contextified: NewContextified(g),
		accountName:  username,
	}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets(g *GlobalContext) ([]string, error) {
	return kc.GetAllAccountNames(g.Env.GetStoredSecretServiceName())
}

func GetTerminalPrompt() string {
	return "Store your key in Apple's local keychain?"
}
