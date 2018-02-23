// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
)

func TestSecretStoreWinFileMigrate(t *testing.T) {

	tc := SetupTest(t, "secret store ops", 1)
	defer tc.Cleanup()

	nu := NewNormalizedUsername("username")
	nu2 := NewNormalizedUsername("username2")
	expectedSecret1 := []byte("test secret 1test secret 1test s")
	expectedSecret2 := []byte("test secret 2test secret 2test s")

	var err error

	fileStore := NewSecretStoreFile(tc.G.Env.GetDataDir())

	// TODO: Use platform-independent errors so they can be
	// checked for.
	var secret LKSecFullSecret
	if secret, err = fileStore.RetrieveSecret(nu); err == nil {
		t.Error("RetrieveSecret unexpectedly returned a nil error")
	}

	if !secret.IsNil() {
		t.Errorf("Retrieved secret unexpectedly: %s", string(secret.Bytes()))
	}

	secret, err = newLKSecFullSecretFromBytes(expectedSecret1)
	if err != nil {
		t.Fatal(err)
	}

	if err = fileStore.StoreSecret(nu, secret); err != nil {
		t.Error(err)
	}

	if secret, err = fileStore.RetrieveSecret(nu); err != nil {
		t.Error(err)
	}

	if string(secret.Bytes()) != string(expectedSecret1) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret.Bytes()), string(expectedSecret1))
	}

	secret, err = newLKSecFullSecretFromBytes(expectedSecret2)
	if err != nil {
		t.Fatal(err)
	}

	if err = fileStore.StoreSecret(nu2, secret); err != nil {
		t.Error(err)
	}

	if secret, err = fileStore.RetrieveSecret(nu2); err != nil {
		t.Error(err)
	}

	if string(secret.Bytes()) != string(expectedSecret2) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret.Bytes()), string(expectedSecret2))
	}

	// Now we have some secret store files, which NewSecretStoreAll()
	// is supposed to move out
	winStore := NewSecretStoreAll(tc.G)

	// Make sure the secrets have been migrated out of the file store
	if secret, err = fileStore.RetrieveSecret(nu); err == nil {
		t.Error("RetrieveSecret unexpectedly returned a nil error")
	}

	if secret, err = fileStore.RetrieveSecret(nu2); err == nil {
		t.Error("RetrieveSecret unexpectedly returned a nil error")
	}

	// Make sure the secrets have been migrated into the windows store
	if secret, err = winStore.RetrieveSecret(nu); err != nil {
		t.Error(err)
	}

	if string(secret.Bytes()) != string(expectedSecret1) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret.Bytes()), string(expectedSecret1))
	}

	if secret, err = winStore.RetrieveSecret(nu2); err != nil {
		t.Error(err)
	}

	// now clear them out of the windows storego
	if string(secret.Bytes()) != string(expectedSecret2) {
		t.Errorf("Retrieved secret %s, expected %s", string(secret.Bytes()), string(expectedSecret2))
	}

	if err = winStore.ClearSecret(nu); err != nil {
		t.Error(err)
	}
	if err = winStore.ClearSecret(nu2); err != nil {
		t.Error(err)
	}
}
