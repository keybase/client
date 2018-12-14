package ephemeral

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
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

func TestEphemeralCloneError(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	g := tc.G
	m := libkb.NewMetaContextForTest(tc)
	ctx := m.Ctx()
	teamID := createTeam(tc)

	ekLib := g.GetEKLib()
	teamEK1, err := ekLib.GetOrCreateLatestTeamEK(ctx, teamID)
	require.NoError(t, err)

	// delete all our deviceEKs and make sure the error comes back as a cloning
	// error since we simulate the cloned state.
	libkb.CreateClonedDevice(tc, m)
	deviceEKStorage := g.GetDeviceEKStorage()
	s := deviceEKStorage.(*DeviceEKStorage)
	allDevicEKs, err := s.GetAll(ctx)
	require.NoError(t, err)
	for _, dek := range allDevicEKs {
		err = s.Delete(ctx, dek.Metadata.Generation)
		require.NoError(t, err)
	}
	_, err = g.GetTeamEKBoxStorage().Get(ctx, teamID, teamEK1.Metadata.Generation, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr := err.(EphemeralKeyError)
	require.Contains(t, ekErr.HumanError(), DeviceCloneErrMsg)
}

func TestEphemeralDeviceProvisionedAfterContent(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	g := tc.G
	m := libkb.NewMetaContextForTest(tc)
	ctx := m.Ctx()
	teamID := createTeam(tc)

	ekLib := g.GetEKLib()
	teamEK1, err := ekLib.GetOrCreateLatestTeamEK(ctx, teamID)
	require.NoError(t, err)

	deviceEKStorage := g.GetDeviceEKStorage()
	s := deviceEKStorage.(*DeviceEKStorage)
	allDevicEKs, err := s.GetAll(ctx)
	require.NoError(t, err)
	for _, dek := range allDevicEKs {
		err = s.Delete(ctx, dek.Metadata.Generation)
		require.NoError(t, err)
	}

	creationCtime := gregor1.ToTime(time.Now().Add(time.Hour * -100))
	_, err = g.GetTeamEKBoxStorage().Get(ctx, teamID, teamEK1.Metadata.Generation, &creationCtime)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr := err.(EphemeralKeyError)
	require.Contains(t, ekErr.HumanError(), DeviceProvisionedAfterContentCreationErrMsg)

	// If no creation ctime is specified, we just get the default error message
	_, err = g.GetTeamEKBoxStorage().Get(ctx, teamID, teamEK1.Metadata.Generation, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr = err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
}
