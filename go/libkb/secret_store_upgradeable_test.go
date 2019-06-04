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

	shouldFallback bool
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
	shouldStoreInFallback := func(options *SecretStoreOptions) bool {
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
	testStore.shouldFallback = true
	ss := testStore.store

	m := NewMetaContextForTest(tc)
	nu := NewNormalizedUsername("tusername")
	secret := makeRandomSecretForTest(t)

	for i := 0; i < 2; i++ {
		t.Logf("Doing Store/Retrieve, attempt %d", i)
		err := ss.StoreSecret(m, nu, secret)
		require.NoError(t, err)

		// Secret should go to secret store B, and not secret store A
		// because we shouldStoreInFallback returns true.
		require.Len(t, testStore.memA.secrets, 0)
		require.Len(t, testStore.memB.secrets, 1)

		rSecret, err := ss.RetrieveSecret(m, nu)
		require.NoError(t, err)
		require.True(t, rSecret.Equal(secret))

		// Try the whole thing twice to ensure consistent behaviour.
	}

	testStore.shouldFallback = false
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
	testStore.shouldFallback = true
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
	testStore.shouldFallback = false

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
	testStore.shouldFallback = true
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
	testStore.shouldFallback = false

	rSecret, err = ss.RetrieveSecret(m, nu)
	require.NoError(t, err)
	require.True(t, rSecret.Equal(secret))

	// Retrieving secret should have upgraded us to store A.
	require.Len(t, testStore.memA.secrets, 1)
	require.Len(t, testStore.memB.secrets, 0)
}
