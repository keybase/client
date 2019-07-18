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

func ephemeralKeyTestSetup(t *testing.T) (libkb.TestContext, libkb.MetaContext, *kbtest.FakeUser) {
	tc := libkb.SetupTest(t, "ephemeral", 2)

	mctx := libkb.NewMetaContextForTest(tc)
	NewEphemeralStorageAndInstall(mctx)

	user, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	return tc, mctx, user
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

func verifyTeamEK(t *testing.T, teamEKMetadata keybase1.TeamEkMetadata,
	ek keybase1.TeamEphemeralKey) {
	typ, err := ek.KeyType()
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamEphemeralKeyType_TEAM, typ)
	teamEK := ek.Team()

	seed := TeamEKSeed(teamEK.Seed)
	keypair := seed.DeriveDHKey()
	require.Equal(t, teamEKMetadata.Kid, keypair.GetKID())
}

func TestEphemeralCloneError(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	g := tc.G
	teamID := createTeam(tc)

	ekLib := g.GetEKLib()
	teamEK1, created, err := ekLib.GetOrCreateLatestTeamEK(mctx, teamID)
	require.NoError(t, err)
	require.True(t, created)

	// delete all our deviceEKs and make sure the error comes back as a cloning
	// error since we simulate the cloned state.
	libkb.CreateClonedDevice(tc, mctx)
	deviceEKStorage := g.GetDeviceEKStorage()
	s := deviceEKStorage.(*DeviceEKStorage)
	allDevicEKs, err := s.GetAll(mctx)
	require.NoError(t, err)
	for _, dek := range allDevicEKs {
		err = s.Delete(mctx, dek.Metadata.Generation)
		require.NoError(t, err)
	}
	_, err = g.GetTeamEKBoxStorage().Get(mctx, teamID, teamEK1.Generation(), nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr := err.(EphemeralKeyError)
	require.Contains(t, ekErr.HumanError(), DeviceCloneErrMsg)
}

func TestEphemeralDeviceProvisionedAfterContent(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	g := tc.G
	teamID := createTeam(tc)

	ekLib := g.GetEKLib()
	teamEK1, created, err := ekLib.GetOrCreateLatestTeamEK(mctx, teamID)
	require.NoError(t, err)
	require.True(t, created)

	deviceEKStorage := g.GetDeviceEKStorage()
	s := deviceEKStorage.(*DeviceEKStorage)
	allDevicEKs, err := s.GetAll(mctx)
	require.NoError(t, err)
	for _, dek := range allDevicEKs {
		err = s.Delete(mctx, dek.Metadata.Generation)
		require.NoError(t, err)
	}

	creationCtime := gregor1.ToTime(time.Now().Add(time.Hour * -100))
	_, err = g.GetTeamEKBoxStorage().Get(mctx, teamID, teamEK1.Generation(), &creationCtime)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr := err.(EphemeralKeyError)
	require.Contains(t, ekErr.HumanError(), DeviceProvisionedAfterContentCreationErrMsg)

	// clear out cached error messages
	g.GetEKLib().ClearCaches(mctx)
	_, err = g.LocalDb.Nuke()
	require.NoError(t, err)

	// If no creation ctime is specified, we just get the default error message
	_, err = g.GetTeamEKBoxStorage().Get(mctx, teamID, teamEK1.Generation(), nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr = err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
}
