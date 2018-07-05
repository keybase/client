package ephemeral

import (
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
