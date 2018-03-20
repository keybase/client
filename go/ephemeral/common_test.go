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

func ephemeralKeyTestSetup(t *testing.T) libkb.TestContext {
	tc := libkb.SetupTest(t, "ephemeral", 2)

	NewEphemeralStorageAndInstall(tc.G)

	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	// The test user has a PUK, but it's not automatically loaded. We have to
	// explicitly sync it.
	keyring, err := tc.G.GetPerUserKeyring()
	require.NoError(t, err)
	err = keyring.Sync(context.Background())
	require.NoError(t, err)

	return tc
}

func TestTimeConversions(t *testing.T) {
	// In this package, we assume that keybase1.TimeFromSeconds(t).UnixSeconds()
	// is the exact same integer as t. Test that this is true.
	now := time.Now().Unix()
	require.Equal(t, now, keybase1.TimeFromSeconds(now).UnixSeconds())
}

func TestDeleteExpiredKeys(t *testing.T) {
	now := keybase1.Time(time.Now().Unix())

	// Test empty
	expired := getExpiredGenerations(make(keyExpiryMap), now)
	expected := []keybase1.EkGeneration(nil)
	require.Equal(t, expected, expired)

	// Test with a single key that is not expired
	keyMap := keyExpiryMap{
		0: now,
	}
	expired = getExpiredGenerations(keyMap, now)
	expected = []keybase1.EkGeneration(nil)
	require.Equal(t, expected, expired)

	// Test with a single key that is expired
	keyMap = keyExpiryMap{
		0: now - KeyLifetimeSecs,
	}
	expired = getExpiredGenerations(keyMap, now)
	expected = []keybase1.EkGeneration{0}
	require.Equal(t, expected, expired)

	// Test with a 6 day gap, but no expiry
	keyMap = keyExpiryMap{
		0: now - keybase1.Time(time.Hour*24*6),
		1: now,
	}
	expired = getExpiredGenerations(keyMap, now)
	expected = []keybase1.EkGeneration(nil)
	require.Equal(t, expected, expired)

	// Test multiple gaps, only the last key is valid though.
	keyMap = make(keyExpiryMap)
	numKeys := 5
	for i := 0; i < numKeys; i++ {
		keyMap[keybase1.EkGeneration((numKeys - i - 1))] = now - KeyLifetimeSecs*keybase1.Time(i)
	}
	expired = getExpiredGenerations(keyMap, now)
	expected = []keybase1.EkGeneration{0, 1, 2}
	require.Equal(t, expected, expired)
}
