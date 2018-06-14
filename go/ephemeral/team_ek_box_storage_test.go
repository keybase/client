package ephemeral

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestTeamEKBoxStorage(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	m := libkb.NewMetaContextForTest(tc)

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	// Login hooks should have run
	deviceEKStorage := tc.G.GetDeviceEKStorage()
	deviceEKMaxGen, err := deviceEKStorage.MaxGeneration(context.Background())
	require.True(t, deviceEKMaxGen > 0)
	require.NoError(t, err)

	userEKBoxStorage := tc.G.GetUserEKBoxStorage()
	userEKMaxGen, err := userEKBoxStorage.MaxGeneration(context.Background())
	require.True(t, userEKMaxGen > 0)
	require.NoError(t, err)

	teamID := createTeam(tc)
	invalidID := teamID + keybase1.TeamID("foo")

	teamEKMetadata, err := publishNewTeamEK(context.Background(), tc.G, teamID, merkleRoot)
	require.NoError(t, err)

	s := tc.G.GetTeamEKBoxStorage()

	// Test Get nonexistent
	nonexistent, err := s.Get(context.Background(), teamID, teamEKMetadata.Generation+1)
	require.Error(t, err)
	require.Equal(t, keybase1.TeamEk{}, nonexistent)

	// Test invalid teamID
	nonexistent2, err := s.Get(context.Background(), invalidID, teamEKMetadata.Generation+1)
	require.Error(t, err)
	require.Equal(t, keybase1.TeamEk{}, nonexistent2)

	// Test get valid & unbox
	teamEK, err := s.Get(context.Background(), teamID, teamEKMetadata.Generation)
	require.NoError(t, err)

	verifyTeamEK(t, teamEKMetadata, teamEK)

	// Test MaxGeneration
	maxGeneration, err := s.MaxGeneration(context.Background(), teamID)
	require.NoError(t, err)
	require.EqualValues(t, 1, maxGeneration)

	// Invalid id
	maxGeneration2, err := s.MaxGeneration(context.Background(), invalidID)
	require.NoError(t, err)
	require.EqualValues(t, -1, maxGeneration2)

	//	NOTE: We don't expose Delete on the interface put on the GlobalContext
	//	since they should never be called, only DeleteExpired should be used.
	//	GetAll is also not exposed since it' only needed for tests.
	rawTeamEKBoxStorage := NewTeamEKBoxStorage(tc.G)
	teamEKs, err := rawTeamEKBoxStorage.GetAll(context.Background(), teamID)
	require.NoError(t, err)
	require.Equal(t, 1, len(teamEKs))

	teamEK, ok := teamEKs[teamEKMetadata.Generation]
	require.True(t, ok)

	verifyTeamEK(t, teamEKMetadata, teamEK)

	// Test invalid
	teamEKs2, err := rawTeamEKBoxStorage.GetAll(context.Background(), invalidID)
	require.NoError(t, err)
	require.Equal(t, 0, len(teamEKs2))

	// Let's delete our userEK and verify we will refetch and unbox properly
	rawUserEKBoxStorage := NewUserEKBoxStorage(tc.G)
	err = rawUserEKBoxStorage.Delete(context.Background(), userEKMaxGen)
	require.NoError(t, err)

	userEKBoxStorage.ClearCache()

	teamEK, err = s.Get(context.Background(), teamID, teamEKMetadata.Generation)
	require.NoError(t, err)
	verifyTeamEK(t, teamEKMetadata, teamEK)

	// No let's the deviceEK which we can't recover from
	rawDeviceEKStorage := NewDeviceEKStorage(tc.G)
	err = rawDeviceEKStorage.Delete(context.Background(), deviceEKMaxGen)
	require.NoError(t, err)

	deviceEKStorage.ClearCache()
	deviceEK, err := deviceEKStorage.Get(context.Background(), deviceEKMaxGen)
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	bad, err := s.Get(context.Background(), teamID, teamEKMetadata.Generation)
	require.Error(t, err)
	require.Equal(t, keybase1.TeamEk{}, bad)

	// test delete
	err = rawTeamEKBoxStorage.Delete(context.Background(), teamID, teamEKMetadata.Generation)
	require.NoError(t, err)
	// delete invalid
	err = rawTeamEKBoxStorage.Delete(context.Background(), invalidID, teamEKMetadata.Generation)
	require.NoError(t, err)

	teamEKs, err = rawTeamEKBoxStorage.GetAll(context.Background(), teamID)
	require.NoError(t, err)
	require.Equal(t, 0, len(teamEKs))

	s.ClearCache()

	maxGeneration3, err := s.MaxGeneration(context.Background(), teamID)
	require.NoError(t, err)
	require.EqualValues(t, -1, maxGeneration3)

	expired, err := s.DeleteExpired(context.Background(), teamID, merkleRoot)
	expected := []keybase1.EkGeneration(nil)
	require.NoError(t, err)
	require.Equal(t, expected, expired)
}

// If we change the key format intentionally, we have to introduce some form of
// migration or versioning between the keys. This test should blow up if we
// break it unintentionally.
func TestTeamEKStorageKeyFormat(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	s := NewTeamEKBoxStorage(tc.G)
	uv, err := getCurrentUserUV(context.Background(), tc.G)
	require.NoError(t, err)

	teamID := createTeam(tc)

	key, err := s.dbKey(context.Background(), teamID)
	require.NoError(t, err)
	expected := fmt.Sprintf("teamEphemeralKeyBox-%s-%s-%s", teamID, s.G().Env.GetUsername(), uv.EldestSeqno)
	require.Equal(t, expected, key.Key)
}
