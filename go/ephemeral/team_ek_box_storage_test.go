package ephemeral

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamEKBoxStorage(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	// Login hooks should have run
	deviceEKStorage := tc.G.GetDeviceEKStorage()
	deviceEKMaxGen, err := deviceEKStorage.MaxGeneration(mctx, false)
	require.True(t, deviceEKMaxGen > 0)
	require.NoError(t, err)

	userEKBoxStorage := tc.G.GetUserEKBoxStorage()
	userEKMaxGen, err := userEKBoxStorage.MaxGeneration(mctx, false)
	require.True(t, userEKMaxGen > 0)
	require.NoError(t, err)

	teamID := createTeam(tc)
	invalidID := teamID + keybase1.TeamID("foo")

	teamEKMetadata, err := publishNewTeamEK(mctx, teamID, merkleRoot)
	require.NoError(t, err)

	s := tc.G.GetTeamEKBoxStorage()

	// Test invalid teamID
	nonexistent2, err := s.Get(mctx, invalidID, teamEKMetadata.Generation+1, nil)
	require.Error(t, err)
	_, ok := err.(EphemeralKeyError)
	require.False(t, ok)
	require.Equal(t, keybase1.TeamEphemeralKey{}, nonexistent2)

	// Test get valid & unbox
	ek, err := s.Get(mctx, teamID, teamEKMetadata.Generation, nil)
	require.NoError(t, err)

	// Make sure we don't pollute bot storage
	botS := tc.G.GetTeambotEKBoxStorage()
	botNonexistant, err := botS.Get(mctx, teamID, teamEKMetadata.Generation, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr := err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
	require.Equal(t, keybase1.TeamEphemeralKey{}, botNonexistant)

	verifyTeamEK(t, teamEKMetadata, ek)

	// Test Get nonexistent
	nonexistent, err := s.Get(mctx, teamID, teamEKMetadata.Generation+1, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr = err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
	require.Equal(t, keybase1.TeamEphemeralKey{}, nonexistent)

	// include the cached error in the max
	maxGeneration, err := s.MaxGeneration(mctx, teamID, true)
	require.NoError(t, err)
	require.EqualValues(t, 2, maxGeneration)

	// Test MaxGeneration
	maxGeneration, err = s.MaxGeneration(mctx, teamID, false)
	require.NoError(t, err)
	require.EqualValues(t, 1, maxGeneration)

	// Invalid id
	maxGeneration2, err := s.MaxGeneration(mctx, invalidID, false)
	require.NoError(t, err)
	require.EqualValues(t, -1, maxGeneration2)

	//	NOTE: We don't expose Delete on the interface put on the GlobalContext
	//	since they should never be called, only DeleteExpired should be used.
	//	GetAll is also not exposed since it' only needed for tests.
	rawTeamEKBoxStorage := NewTeamEKBoxStorage(NewTeamEphemeralKeyer())
	teamEKs, err := rawTeamEKBoxStorage.GetAll(mctx, teamID)
	require.NoError(t, err)
	require.Equal(t, 1, len(teamEKs))

	ek, ok = teamEKs[teamEKMetadata.Generation]
	require.True(t, ok)

	verifyTeamEK(t, teamEKMetadata, ek)

	// Test invalid
	teamEKs2, err := rawTeamEKBoxStorage.GetAll(mctx, invalidID)
	require.NoError(t, err)
	require.Equal(t, 0, len(teamEKs2))

	// Let's delete our userEK and verify we will refetch and unbox properly
	rawUserEKBoxStorage := NewUserEKBoxStorage()
	err = rawUserEKBoxStorage.Delete(mctx, userEKMaxGen)
	require.NoError(t, err)

	userEKBoxStorage.ClearCache()

	ek, err = s.Get(mctx, teamID, teamEKMetadata.Generation, nil)
	require.NoError(t, err)
	verifyTeamEK(t, teamEKMetadata, ek)

	// No let's the deviceEK which we can't recover from
	rawDeviceEKStorage := NewDeviceEKStorage(mctx)
	err = rawDeviceEKStorage.Delete(mctx, deviceEKMaxGen)
	require.NoError(t, err)

	deviceEKStorage.ClearCache()
	deviceEK, err := deviceEKStorage.Get(mctx, deviceEKMaxGen)
	require.Error(t, err)
	_, ok = err.(libkb.UnboxError)
	require.True(t, ok)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	bad, err := s.Get(mctx, teamID, teamEKMetadata.Generation, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr = err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
	require.Equal(t, keybase1.TeamEphemeralKey{}, bad)

	// test delete
	err = rawTeamEKBoxStorage.Delete(mctx, teamID, teamEKMetadata.Generation)
	require.NoError(t, err)
	// delete invalid
	err = rawTeamEKBoxStorage.Delete(mctx, invalidID, teamEKMetadata.Generation)
	require.NoError(t, err)

	teamEKs, err = rawTeamEKBoxStorage.GetAll(mctx, teamID)
	require.NoError(t, err)
	require.Equal(t, 0, len(teamEKs))

	s.ClearCache()

	maxGeneration3, err := s.MaxGeneration(mctx, teamID, false)
	require.NoError(t, err)
	require.EqualValues(t, -1, maxGeneration3)

	expired, err := s.DeleteExpired(mctx, teamID, merkleRoot)
	expected := []keybase1.EkGeneration(nil)
	require.NoError(t, err)
	require.Equal(t, expected, expired)

	// Verify we store failures in the cache
	t.Logf("cache failures")
	nonexistent, err = rawTeamEKBoxStorage.Get(mctx, teamID, teamEKMetadata.Generation+1, nil)
	require.Error(t, err)
	require.Equal(t, keybase1.TeamEphemeralKey{}, nonexistent)
	cache, found, err := rawTeamEKBoxStorage.getCacheForTeamID(mctx, teamID)
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, cache, 1)

	cacheItem, ok := cache[teamEKMetadata.Generation+1]
	require.True(t, ok)
	require.True(t, cacheItem.HasError())
}

// If we change the key format intentionally, we have to introduce some form of
// migration or versioning between the keys. This test should blow up if we
// break it unintentionally.
func TestTeamEKStorageKeyFormat(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	s := NewTeamEKBoxStorage(NewTeamEphemeralKeyer())
	uv, err := tc.G.GetMeUV(context.TODO())
	require.NoError(t, err)

	teamID := createTeam(tc)

	key, err := s.dbKey(mctx, teamID)
	require.NoError(t, err)
	expected := fmt.Sprintf("teamEphemeralKeyBox-%s-%s-%s-%s-%d", keybase1.TeamEphemeralKeyType_TEAM,
		teamID, mctx.G().Env.GetUsername(), uv.EldestSeqno, teamEKBoxStorageDBVersion)
	require.Equal(t, expected, key.Key)

	s = NewTeamEKBoxStorage(NewTeambotEphemeralKeyer())
	key, err = s.dbKey(mctx, teamID)
	require.NoError(t, err)
	expected = fmt.Sprintf("teamEphemeralKeyBox-%s-%s-%s-%s-%d", keybase1.TeamEphemeralKeyType_TEAMBOT,
		teamID, mctx.G().Env.GetUsername(), uv.EldestSeqno, teamEKBoxStorageDBVersion)
	require.Equal(t, expected, key.Key)
}
