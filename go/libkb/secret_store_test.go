// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSecretStoreOps(t *testing.T) {
	tc := SetupTest(t, "secret store ops", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	nu := NewNormalizedUsername("username")
	expectedSecret1 := []byte("test secret 1test secret 1test s")
	expectedSecret2 := []byte("test secret 2test secret 2test s")

	var err error

	if err = tc.G.SecretStore().ClearSecret(m, nu); err != nil {
		t.Error(err)
	}

	// TODO: Use platform-independent errors so they can be
	// checked for.
	var secret LKSecFullSecret
	if secret, err = tc.G.SecretStore().RetrieveSecret(m, nu); err == nil {
		t.Error("RetrieveSecret unexpectedly returned a nil error")
	}

	if !secret.IsNil() {
		t.Errorf("Retrieved secret unexpectedly: %s", string(secret.Bytes()))
	}

	secret, err = newLKSecFullSecretFromBytes(expectedSecret1)
	if err != nil {
		t.Fatal(err)
	}

	if err = tc.G.SecretStore().StoreSecret(m, nu, secret); err != nil {
		t.Error(err)
	}

	if secret, err = tc.G.SecretStore().RetrieveSecret(m, nu); err != nil {
		t.Error(err)
	}

	if string(secret.Bytes()) != string(expectedSecret1) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret.Bytes()), string(expectedSecret1))
	}

	secret, err = newLKSecFullSecretFromBytes(expectedSecret2)
	if err != nil {
		t.Fatal(err)
	}

	if err = tc.G.SecretStore().StoreSecret(m, nu, secret); err != nil {
		t.Error(err)
	}

	if secret, err = tc.G.SecretStore().RetrieveSecret(m, nu); err != nil {
		t.Error(err)
	}

	if string(secret.Bytes()) != string(expectedSecret2) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret.Bytes()), string(expectedSecret2))
	}

	if err = tc.G.SecretStore().ClearSecret(m, nu); err != nil {
		t.Error(err)
	}
}

func TestGetUsersWithStoredSecrets(t *testing.T) {

	tc := SetupTest(t, "get users with stored secrets", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	usernames, err := tc.G.SecretStore().GetUsersWithStoredSecrets(m)
	if err != nil {
		t.Error(err)
	}
	if len(usernames) != 0 {
		t.Errorf("Expected no usernames, got %d", len(usernames))
	}

	fs, err := newLKSecFullSecretFromBytes([]byte("test secret 3test secret 3test s"))
	if err != nil {
		t.Fatal(err)
	}

	expectedUsernames := make([]string, 10)
	for i := 0; i < len(expectedUsernames); i++ {
		expectedUsernames[i] = fmt.Sprintf("account with unicode テスト %d", i)

		if err := tc.G.SecretStore().StoreSecret(m, NewNormalizedUsername(expectedUsernames[i]), fs); err != nil {
			t.Error(err)
		}
	}

	usernames, err = tc.G.SecretStore().GetUsersWithStoredSecrets(m)
	if err != nil {
		t.Error(err)
	}

	if len(usernames) != len(expectedUsernames) {
		t.Errorf("Expected %d usernames, got %d", len(expectedUsernames), len(usernames))
	}

	// TODO: were these supposed to already be in order?
	sort.Strings(usernames)

	for i := 0; i < len(usernames); i++ {
		if usernames[i] != expectedUsernames[i] {
			t.Errorf("Expected username %s, got %s", expectedUsernames[i], usernames[i])
		}
	}

	for i := 0; i < len(expectedUsernames); i++ {
		err = tc.G.SecretStore().ClearSecret(m, NewNormalizedUsername(expectedUsernames[i]))
		if err != nil {
			t.Error(err)
		}
	}

	usernames, err = tc.G.SecretStore().GetUsersWithStoredSecrets(m)
	if err != nil {
		t.Error(err)
	}
	if len(usernames) != 0 {
		t.Errorf("Expected no usernames, got %d", len(usernames))
	}
}

func TestPrimeSecretStore(t *testing.T) {
	tc := SetupTest(t, "secret_store", 1)
	defer tc.Cleanup()
	tc.G.Env.Test.SecretStorePrimingDisabled = false

	mctx := NewMetaContextForTest(tc)
	err := mctx.G().SecretStore().PrimeSecretStores(mctx)
	require.NoError(t, err)
}
