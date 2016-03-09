// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sort"
	"testing"
)

func TestSecretStoreOps(t *testing.T) {

	tc := SetupTest(t, "secret store ops")
	defer tc.Cleanup()

	nu := NewNormalizedUsername("username")
	expectedSecret1 := []byte("test secret 1")
	expectedSecret2 := []byte("test secret 2")

	var err error

	if err = tc.G.SecretStoreAll.ClearSecret(nu); err != nil {
		t.Error(err)
	}

	// TODO: Use platform-independent errors so they can be
	// checked for.
	var secret []byte
	if secret, err = tc.G.SecretStoreAll.RetrieveSecret(nu); err == nil {
		t.Error("RetrieveSecret unexpectedly returned a nil error")
	}

	if secret != nil {
		t.Errorf("Retrieved secret unexpectedly: %s", string(secret))
	}

	if err = tc.G.SecretStoreAll.StoreSecret(nu, expectedSecret1); err != nil {
		t.Error(err)
	}

	if secret, err = tc.G.SecretStoreAll.RetrieveSecret(nu); err != nil {
		t.Error(err)
	}

	if string(secret) != string(expectedSecret1) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret), string(expectedSecret1))
	}

	if err = tc.G.SecretStoreAll.StoreSecret(nu, expectedSecret2); err != nil {
		t.Error(err)
	}

	if secret, err = tc.G.SecretStoreAll.RetrieveSecret(nu); err != nil {
		t.Error(err)
	}

	if string(secret) != string(expectedSecret2) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret), string(expectedSecret2))
	}

	if err = tc.G.SecretStoreAll.ClearSecret(nu); err != nil {
		t.Error(err)
	}
}

func TestGetUsersWithStoredSecrets(t *testing.T) {

	tc := SetupTest(t, "get users with stored secrets")
	defer tc.Cleanup()

	usernames, err := tc.G.SecretStoreAll.GetUsersWithStoredSecrets()
	if err != nil {
		t.Error(err)
	}
	if len(usernames) != 0 {
		t.Errorf("Expected no usernames, got %d", len(usernames))
	}

	expectedUsernames := make([]string, 10)
	for i := 0; i < len(expectedUsernames); i++ {
		expectedUsernames[i] = fmt.Sprintf("account with unicode テスト %d", i)
		if err := tc.G.SecretStoreAll.StoreSecret(NewNormalizedUsername(expectedUsernames[i]), []byte{}); err != nil {
			t.Error(err)
		}
	}

	usernames, err = tc.G.SecretStoreAll.GetUsersWithStoredSecrets()
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
		err = tc.G.SecretStoreAll.ClearSecret(NewNormalizedUsername(expectedUsernames[i]))
		if err != nil {
			t.Error(err)
		}
	}

	usernames, err = tc.G.SecretStoreAll.GetUsersWithStoredSecrets()
	if err != nil {
		t.Error(err)
	}
	if len(usernames) != 0 {
		t.Errorf("Expected no usernames, got %d", len(usernames))
	}
}
