// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!android

package libkb

import (
	"errors"
)

// Used by tests that want to mock out the secret store.
type TestSecretStoreAll struct {
	context            SecretStoreContext
	secretStoreNoneMap map[NormalizedUsername][]byte
	Contextified
}

func (t TestSecretStoreAll) GetUsersWithStoredSecrets() (ret []string, err error) {
	for name := range t.secretStoreNoneMap {
		ret = append(ret, string(name))
	}
	return
}

func (t TestSecretStoreAll) GetTerminalPrompt() string {
	return "Store your key in the local secret store?"
}

func (t TestSecretStoreAll) GetApprovalPrompt() string {
	return "Store your key in the local secret store?"
}

func NewTestSecretStoreAll(c SecretStoreContext, g *GlobalContext) SecretStoreAll {
	ret := TestSecretStoreAll{context: c, secretStoreNoneMap: map[NormalizedUsername][]byte{}}
	ret.SetGlobalContext(g)
	return ret
}

func (t TestSecretStoreAll) GetAllUserNames() (NormalizedUsername, []NormalizedUsername, error) {
	return t.context.GetAllUserNames()
}

func (t TestSecretStoreAll) RetrieveSecret(accountName NormalizedUsername) (ret []byte, err error) {

	ret, ok := t.secretStoreNoneMap[accountName]

	t.G().Log.Debug("| TestSecretStore::RetrieveSecret(%d)", len(ret))

	if !ok {
		return nil, errors.New("No secret to retrieve")
	}

	return
}

func (t TestSecretStoreAll) StoreSecret(accountName NormalizedUsername, secret []byte) error {
	t.G().Log.Debug("| TestSecretStore::StoreSecret(%d)", len(secret))

	t.secretStoreNoneMap[accountName] = secret
	return nil
}

func (t TestSecretStoreAll) ClearSecret(accountName NormalizedUsername) error {
	t.G().Log.Debug("| TestSecretStore::ClearSecret()")

	delete(t.secretStoreNoneMap, accountName)
	return nil
}
