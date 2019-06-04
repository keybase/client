package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func setUpgradeableSecretStoreForTest(G *GlobalContext, ss *SecretStoreUpgradeable) {
	ssl := NewSecretStoreLocked(NewMetaContextBackground(G))
	ssl.disk = ss

	G.secretStoreMu.Lock()
	G.secretStore = ssl
	G.secretStoreMu.Unlock()
}

func makeRandomSecretForTest(t *testing.T) LKSecFullSecret {
	randBytes, err := RandBytes(LKSecLen)
	require.NoError(t, err)
	secret, err := newLKSecFullSecretFromBytes(randBytes)
	require.NoError(t, err)
	return secret
}

func TestUpgradeableSecretStore(t *testing.T) {
	tc := SetupTest(t, "secret store ops", 1)
	defer tc.Cleanup()

	ssa := NewSecretStoreMem()
	ssb := NewSecretStoreMem()

	shouldFallback := true

	shouldUpgradeOpportunistically := func() bool {
		return false
	}
	shouldStoreInFallback := func(options *SecretStoreOptions) bool {
		return shouldFallback
	}

	ss := NewSecretStoreUpgradeable(ssa, ssb, shouldUpgradeOpportunistically, shouldStoreInFallback)

	m := NewMetaContextForTest(tc)
	nu := NewNormalizedUsername("tusername")
	secret := makeRandomSecretForTest(t)

	for i := 0; i < 2; i++ {
		t.Logf("Doing Store/Retrieve, attempt %d", i)
		err := ss.StoreSecret(m, nu, secret)
		require.NoError(t, err)

		// Secret should go to secret store B, and not secret store A
		// because we shouldStoreInFallback returns true.
		require.Len(t, ssa.secrets, 0)
		require.Len(t, ssb.secrets, 1)

		_, err = ss.RetrieveSecret(m, nu)
		require.NoError(t, err)

		// Try the whole thing twice to ensure consistent behaviour.
	}

	// Not doing fallback anymore, store B should be cleared for NU and
	// secret should be exclusively in store A.
	t.Logf("Changed shouldFallback to false, trying to store again")
	shouldFallback = false
	err := ss.StoreSecret(m, nu, secret)
	require.NoError(t, err)

	require.Len(t, ssa.secrets, 1)
	require.Len(t, ssb.secrets, 0)
}
