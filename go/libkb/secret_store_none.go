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
	secretStoreNoneMap map[NormalizedUsername]LKSecFullSecret
	Contextified
}

func (t TestSecretStoreAll) GetUsersWithStoredSecrets() (ret []string, err error) {
	panic("someone uses this")
	for name := range t.secretStoreNoneMap {
		ret = append(ret, string(name))
	}
	return
}

func (t TestSecretStoreAll) GetTerminalPrompt() string {
	panic("someone uses this")
	return "Store your key in the local secret store?"
}

func (t TestSecretStoreAll) GetApprovalPrompt() string {
	panic("someone uses this")
	return "Store your key in the local secret store?"
}

func NewTestSecretStoreAll(c SecretStoreContext, g *GlobalContext) SecretStoreAll {
	panic("someone uses this")
	ret := TestSecretStoreAll{context: c, secretStoreNoneMap: make(map[NormalizedUsername]LKSecFullSecret)}
	ret.SetGlobalContext(g)
	return ret
}

func (t TestSecretStoreAll) GetAllUserNames() (NormalizedUsername, []NormalizedUsername, error) {
	panic("someone uses this")
	return t.context.GetAllUserNames()
}

func (t TestSecretStoreAll) RetrieveSecret(accountName NormalizedUsername) (ret LKSecFullSecret, err error) {
	panic("someone uses this")

	ret, ok := t.secretStoreNoneMap[accountName]

	t.G().Log.Debug("| TestSecretStore::RetrieveSecret(isNil=%v)", ret.IsNil())

	if !ok {
		return LKSecFullSecret{}, errors.New("No secret to retrieve")
	}

	return ret, nil
}

func (t TestSecretStoreAll) StoreSecret(accountName NormalizedUsername, secret LKSecFullSecret) error {
	panic("someone uses this")
	t.G().Log.Debug("| TestSecretStore::StoreSecret(isNil=%v)", secret.IsNil())

	t.secretStoreNoneMap[accountName] = secret
	return nil
}

func (t TestSecretStoreAll) ClearSecret(accountName NormalizedUsername) error {
	panic("someone uses this")
	t.G().Log.Debug("| TestSecretStore::ClearSecret()")

	delete(t.secretStoreNoneMap, accountName)
	return nil
}
