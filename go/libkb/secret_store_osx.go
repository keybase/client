// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build darwin,!ios

package libkb

import (
	"encoding/base64"

	kc "github.com/keybase/go-osxkeychain"
)

type KeychainSecretStore struct {
	accountName NormalizedUsername
}

func (kss *KeychainSecretStore) StoreSecret(secret []byte) (err error) {
	G.Log.Debug("+ StoreSecret(%s, %d)", kss.accountName, len(secret))
	defer func() {
		G.Log.Debug("- StoreSecret -> %s", ErrToOk(err))
	}()

	// base64-encode to make it easy to work with Keychain Access.
	encodedSecret := base64.StdEncoding.EncodeToString(secret)
	attributes := kc.GenericPasswordAttributes{
		ServiceName: G.Env.GetStoredSecretServiceName(),
		AccountName: kss.accountName.String(),
		Password:    []byte(encodedSecret),
	}
	err = kc.RemoveAndAddGenericPassword(&attributes)
	return
}

func (kss *KeychainSecretStore) RetrieveSecret() (secret []byte, err error) {
	G.Log.Debug("+ RetrieveSecret(%s)", kss.accountName)
	defer func() {
		G.Log.Debug("- RetrieveSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: G.Env.GetStoredSecretServiceName(),
		AccountName: kss.accountName.String(),
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

func (kss *KeychainSecretStore) ClearSecret() (err error) {
	G.Log.Debug("+ ClearSecret(%s)", kss.accountName)
	defer func() {
		G.Log.Debug("- ClearSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: G.Env.GetStoredSecretServiceName(),
		AccountName: kss.accountName.String(),
	}

	err = kc.FindAndRemoveGenericPassword(&attributes)
	// Don't count the item not being found as an error.
	if err == kc.ErrItemNotFound {
		err = nil
	}
	return
}

func NewSecretStore(username NormalizedUsername) SecretStore {
	return &KeychainSecretStore{username}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets() ([]string, error) {
	return kc.GetAllAccountNames(G.Env.GetStoredSecretServiceName())
}

func GetTerminalPrompt() string {
	return "Store your key in Apple's local keychain?"
}
