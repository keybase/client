// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func makeRandomSecretForTest(t *testing.T) LKSecFullSecret {
	randBytes, err := RandBytes(LKSecLen)
	require.NoError(t, err)
	secret, err := newLKSecFullSecretFromBytes(randBytes)
	require.NoError(t, err)
	return secret
}

type secretStoreUpgForTest struct {
	store *SecretStoreUpgradeable
	memA  *SecretStoreMem
	memB  *SecretStoreMem

	shouldFallback SecretStoreFallbackBehavior
	shouldUpgrade  bool
}

func newSecretStoreUpgForTest() *secretStoreUpgForTest {
	store := secretStoreUpgForTest{
		memA: NewSecretStoreMem(),
		memB: NewSecretStoreMem(),
	}

	shouldUpgradeOpportunistically := func() bool {
		return store.shouldUpgrade
	}
	shouldStoreInFallback := func(options *SecretStoreOptions) SecretStoreFallbackBehavior {
		return store.shouldFallback
	}

	store.store = NewSecretStoreUpgradeable(store.memA, store.memB,
		shouldUpgradeOpportunistically, shouldStoreInFallback)
	return &store
}

func TestUSSUpgradeOnStore(t *testing.T) {
	tc := SetupTest(t, "secret store ops", 1)
	defer tc.Cleanup()

	testStore := newSecretStoreUpgForTest()
	testStore.shouldFallback = SecretStoreFallbackBehaviorAlways
	ss := testStore.store

	m := NewMetaContextForTest(tc)
	nu := NewNormalizedUsername("tusername")
	secret := makeRandomSecretForTest(t)

	for i := 0; i < 2; i++ {
		t.Logf("Doing Store/Retrieve, attempt %d", i)
		err := ss.StoreSecret(m, nu, secret)
		require.NoError(t, err)

		// Secret should go to secret store B, and not secret store A
		// because of fallback behavior.
		require.Len(t, testStore.memA.secrets, 0)
		require.Len(t, testStore.memB.secrets, 1)

		rSecret, err := ss.RetrieveSecret(m, nu)
		require.NoError(t, err)
		require.True(t, rSecret.Equal(secret))

		// Try the whole thing twice to ensure consistent behaviour.
	}

	testStore.shouldFallback = SecretStoreFallbackBehaviorNever
	for i := 0; i < 2; i++ {
		// Not doing fallback anymore, store B should be cleared for NU and
		// secret should be exclusively in store A.
		t.Logf("shouldFallback = false, trying again, attempt %d", i)
		err := ss.StoreSecret(m, nu, secret)
		require.NoError(t, err)

		require.Len(t, testStore.memA.secrets, 1)
		require.Len(t, testStore.memB.secrets, 0)

		rSecret, err := ss.RetrieveSecret(m, nu)
		require.NoError(t, err)
		require.True(t, rSecret.Equal(secret))
	}
}

func TestUSSUpgrade(t *testing.T) {
	tc := SetupTest(t, "secret store ops", 1)
	defer tc.Cleanup()

	testStore := newSecretStoreUpgForTest()
	testStore.shouldFallback = SecretStoreFallbackBehaviorAlways
	ss := testStore.store

	m := NewMetaContextForTest(tc)
	nu := NewNormalizedUsername("tusername")
	secret := makeRandomSecretForTest(t)

	err := ss.StoreSecret(m, nu, secret)
	require.NoError(t, err)

	// Secret should go to secret store B, and not secret store A
	// because we shouldStoreInFallback returns true.
	require.Len(t, testStore.memA.secrets, 0)
	require.Len(t, testStore.memB.secrets, 1)

	rSecret, err := ss.RetrieveSecret(m, nu)
	require.NoError(t, err)
	require.True(t, rSecret.Equal(secret))

	// Not in fallback anymore, subsequent stores should store secret in store
	// A (and clear leftovers in store B).
	testStore.shouldFallback = SecretStoreFallbackBehaviorNever

	// Retrieve does not upgrade us because shouldUpgrade returns false.
	rSecret, err = ss.RetrieveSecret(m, nu)
	require.NoError(t, err)
	require.True(t, rSecret.Equal(secret))

	require.Len(t, testStore.memA.secrets, 0)
	require.Len(t, testStore.memB.secrets, 1)

	// StoreSecret again will upgrade us and clear store B for username.
	err = ss.StoreSecret(m, nu, secret)
	require.NoError(t, err)

	require.Len(t, testStore.memA.secrets, 1)
	require.Len(t, testStore.memB.secrets, 0)

	rSecret, err = ss.RetrieveSecret(m, nu)
	require.NoError(t, err)
	require.True(t, rSecret.Equal(secret))
}

func TestUSSOpportunisticUpgrade(t *testing.T) {
	tc := SetupTest(t, "secret store ops", 1)
	defer tc.Cleanup()

	testStore := newSecretStoreUpgForTest()
	testStore.shouldFallback = SecretStoreFallbackBehaviorAlways
	testStore.shouldUpgrade = true
	ss := testStore.store

	m := NewMetaContextForTest(tc)
	nu := NewNormalizedUsername("tusername")
	secret := makeRandomSecretForTest(t)

	err := ss.StoreSecret(m, nu, secret)
	require.NoError(t, err)

	// Secret should go to secret store B, and not secret store A
	// because we shouldStoreInFallback returns true.
	require.Len(t, testStore.memA.secrets, 0)
	require.Len(t, testStore.memB.secrets, 1)

	rSecret, err := ss.RetrieveSecret(m, nu)
	require.NoError(t, err)
	require.True(t, rSecret.Equal(secret))

	// We are still in fallback mode, so upgrade should not happen after last
	// retrieval.
	require.Len(t, testStore.memA.secrets, 0)
	require.Len(t, testStore.memB.secrets, 1)

	// Change shouldFallback to false (user upgraded their machine / settings
	// for example).
	testStore.shouldFallback = SecretStoreFallbackBehaviorNever

	rSecret, err = ss.RetrieveSecret(m, nu)
	require.NoError(t, err)
	require.True(t, rSecret.Equal(secret))

	// Retrieving secret should have upgraded us to store A.
	require.Len(t, testStore.memA.secrets, 1)
	require.Len(t, testStore.memB.secrets, 0)
}

func TestUSSFallback(t *testing.T) {
	tc := SetupTest(t, "secret store ops", 1)
	defer tc.Cleanup()

	failA := NewSecretStoreFail()
	memB := NewSecretStoreMem()

	behavior := SecretStoreFallbackBehaviorOnError
	shouldUpgradeOpportunistically := func() bool {
		return true
	}
	shouldStoreInFallback := func(options *SecretStoreOptions) SecretStoreFallbackBehavior {
		return behavior
	}

	store := NewSecretStoreUpgradeable(failA, memB,
		shouldUpgradeOpportunistically, shouldStoreInFallback)

	m := NewMetaContextForTest(tc)
	nu := NewNormalizedUsername("tusername")
	secret := makeRandomSecretForTest(t)

	err := store.StoreSecret(m, nu, secret)
	require.NoError(t, err)
	require.Len(t, memB.secrets, 1)

	rSecret, err := store.RetrieveSecret(m, nu)
	require.NoError(t, err)
	require.True(t, rSecret.Equal(secret))

	t.Logf("Changing behavior to SecretStoreFallbackBehaviorNever")
	behavior = SecretStoreFallbackBehaviorNever

	for i := 0; i < 2; i++ {
		t.Logf("Attempt %d", i)

		// We should still be able to retrieve our secret.
		rSecret, err := store.RetrieveSecret(m, nu)
		require.NoError(t, err)
		require.True(t, rSecret.Equal(secret))

		// But we can't store a new one.
		err = store.StoreSecret(m, nu, secret)
		require.Error(t, err)

		// Still has old secret.
		require.Len(t, memB.secrets, 1)

		// Try this twice, to be sure that:
		// - first retrieval does not affect subsequent ones.
		// - failed StoreSecret to primary secret store does not affect subsequent
		// retrievals from fallback.
	}

	// Clear should clear fallback store as well, despite behavior setting.
	t.Logf("Trying to ClearSecret")
	err = store.ClearSecret(m, nu)
	require.NoError(t, err)
	require.Len(t, memB.secrets, 0)
}
