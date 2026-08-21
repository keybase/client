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

	err = tc.G.SecretStore().ClearSecret(m, nu)
	require.NoError(t, err)

	// TODO: Use platform-independent errors so they can be
	// checked for.
	var secret LKSecFullSecret
	secret, err = tc.G.SecretStore().RetrieveSecret(m, nu)
	require.Error(t, err, "RetrieveSecret unexpectedly returned a nil error")

	require.True(t, secret.IsNil(), "Retrieved secret unexpectedly: %s", string(secret.Bytes()))

	secret, err = newLKSecFullSecretFromBytes(expectedSecret1)
	require.NoError(t, err)

	err = tc.G.SecretStore().StoreSecret(m, nu, secret)
	require.NoError(t, err)

	secret, err = tc.G.SecretStore().RetrieveSecret(m, nu)
	require.NoError(t, err)

	require.Equal(t, string(expectedSecret1), string(secret.Bytes()), "Retrieved secret %s, expected %s", string(secret.Bytes()), string(expectedSecret1))

	secret, err = newLKSecFullSecretFromBytes(expectedSecret2)
	require.NoError(t, err)

	err = tc.G.SecretStore().StoreSecret(m, nu, secret)
	require.NoError(t, err)

	secret, err = tc.G.SecretStore().RetrieveSecret(m, nu)
	require.NoError(t, err)

	require.Equal(t, string(expectedSecret2), string(secret.Bytes()), "Retrieved secret %s, expected %s", string(secret.Bytes()), string(expectedSecret2))

	err = tc.G.SecretStore().ClearSecret(m, nu)
	require.NoError(t, err)
}

func TestGetUsersWithStoredSecrets(t *testing.T) {
	tc := SetupTest(t, "get users with stored secrets", 1)
	defer tc.Cleanup()
	m := NewMetaContextForTest(tc)

	usernames, err := tc.G.SecretStore().GetUsersWithStoredSecrets(m)
	require.NoError(t, err)
	require.Empty(t, usernames, "Expected no usernames, got %d", len(usernames))

	fs, err := newLKSecFullSecretFromBytes([]byte("test secret 3test secret 3test s"))
	require.NoError(t, err)

	expectedUsernames := make([]string, 10)
	for i := range expectedUsernames {
		expectedUsernames[i] = fmt.Sprintf("account with unicode テスト %d", i)

		err := tc.G.SecretStore().StoreSecret(m, NewNormalizedUsername(expectedUsernames[i]), fs)
		require.NoError(t, err)
	}

	usernames, err = tc.G.SecretStore().GetUsersWithStoredSecrets(m)
	require.NoError(t, err)

	require.Len(t, usernames, len(expectedUsernames), "Expected %d usernames, got %d", len(expectedUsernames), len(usernames))

	// TODO: were these supposed to already be in order?
	sort.Strings(usernames)

	for i := 0; i < len(usernames); i++ {
		require.Equal(t, expectedUsernames[i], usernames[i], "Expected username %s, got %s", expectedUsernames[i], usernames[i])
	}

	for i := range expectedUsernames {
		err = tc.G.SecretStore().ClearSecret(m, NewNormalizedUsername(expectedUsernames[i]))
		require.NoError(t, err)
	}

	usernames, err = tc.G.SecretStore().GetUsersWithStoredSecrets(m)
	require.NoError(t, err)
	require.Empty(t, usernames, "Expected no usernames, got %d", len(usernames))
}

func TestPrimeSecretStore(t *testing.T) {
	tc := SetupTest(t, "secret_store", 1)
	defer tc.Cleanup()
	tc.G.Env.Test.SecretStorePrimingDisabled = false

	mctx := NewMetaContextForTest(tc)
	err := mctx.G().SecretStore().PrimeSecretStores(mctx)
	require.NoError(t, err)
}
