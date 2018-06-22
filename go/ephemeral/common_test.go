package ephemeral

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func ephemeralKeyTestSetup(t *testing.T) (libkb.TestContext, *kbtest.FakeUser) {
	tc := libkb.SetupTest(t, "ephemeral", 2)

	NewEphemeralStorageAndInstall(tc.G)

	user, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	return tc, user
}

func TestTimeConversions(t *testing.T) {
	// In this package, we assume that keybase1.TimeFromSeconds(t).UnixSeconds()
	// is the exact same integer as t. Test that this is true.
	now := time.Now().Unix()
	require.Equal(t, now, keybase1.TimeFromSeconds(now).UnixSeconds())
}

func TestDeleteExpiredKeys(t *testing.T) {
	tc := libkb.SetupTest(t, "ephemeral", 2)
	defer tc.Cleanup()

	now := time.Now()

	// Test empty
	expired := getExpiredGenerations(context.Background(), tc.G, make(keyExpiryMap), now)
	var expected []keybase1.EkGeneration
	expected = nil
	require.Equal(t, expected, expired)

	// Test with a single key that is not expired
	keyMap := keyExpiryMap{
		0: keybase1.ToTime(now),
	}
	expired = getExpiredGenerations(context.Background(), tc.G, keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)

	// Test with a single key that is stale but not expired
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStalenessSecs)),
	}
	expired = getExpiredGenerations(context.Background(), tc.G, keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)

	// Test with a single key that is expired
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStalenessSecs).Add(-libkb.MaxEphemeralContentLifetime)),
	}
	expired = getExpiredGenerations(context.Background(), tc.G, keyMap, now)
	expected = []keybase1.EkGeneration{0}
	require.Equal(t, expected, expired)

	// Test with a 6 day gap, but no expiry
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-time.Hour * 24 * 6)),
		1: keybase1.ToTime(now),
	}
	expired = getExpiredGenerations(context.Background(), tc.G, keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)

	// Test multiple gaps, only the last key is valid though.
	keyMap = make(keyExpiryMap)
	numKeys := 5
	for i := 0; i < numKeys; i++ {
		keyMap[keybase1.EkGeneration((numKeys - i - 1))] = keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStalenessSecs * time.Duration(i)))
	}
	expired = getExpiredGenerations(context.Background(), tc.G, keyMap, now)
	expected = []keybase1.EkGeneration{0, 1, 2}
	require.Equal(t, expected, expired)

	// Test case from bug
	now = keybase1.Time(1528818944000).Time()
	keyMap = keyExpiryMap{
		46: 1528207927000,
		47: 1528294344000,
		48: 1528382176000,
		49: 1528472751000,
		50: 1528724605000,
		51: 1528811030000,
	}
	expired = getExpiredGenerations(context.Background(), tc.G, keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)
}

func verifyUserEK(t *testing.T, metadata keybase1.UserEkMetadata, ek keybase1.UserEk) {
	seed := UserEKSeed(ek.Seed)
	keypair := seed.DeriveDHKey()
	require.Equal(t, metadata.Kid, keypair.GetKID())
}

func verifyTeamEK(t *testing.T, metadata keybase1.TeamEkMetadata, ek keybase1.TeamEk) {
	seed := TeamEKSeed(ek.Seed)
	keypair := seed.DeriveDHKey()
	require.Equal(t, metadata.Kid, keypair.GetKID())
}
