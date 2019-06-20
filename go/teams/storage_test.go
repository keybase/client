package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	storage "github.com/keybase/client/go/teams/storage"
	"github.com/stretchr/testify/require"
)

func getStorageFromG(g *libkb.GlobalContext) *storage.Storage {
	tl := g.GetTeamLoader().(*TeamLoader)
	return tl.storage
}

// Storage can get from memory
func TestStorageMem(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	for _, public := range []bool{false, true} {
		teamID := NewSubteamID(false /*public*/)
		st := getStorageFromG(tc.G)
		mctx := libkb.NewMetaContextForTest(tc)
		obj := keybase1.TeamData{
			Chain: keybase1.TeamSigChainState{
				Id:     teamID,
				Public: public,
			},
		}

		res, _, _ := st.Get(mctx, teamID, public)
		require.Nil(t, res)
		st.Put(mctx, &obj)
		res, _, _ = st.Get(mctx, teamID, public)
		require.NotNil(t, res, "cache miss")
		require.True(t, res == &obj, "should be the same obj from mem")
	}
}

// Storage can get from disk.
func TestStorageDisk(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	for _, public := range []bool{false, true} {
		teamID := NewSubteamID(false /*public*/)
		st := getStorageFromG(tc.G)
		mctx := libkb.NewMetaContextForTest(tc)
		obj := keybase1.TeamData{
			Chain: keybase1.TeamSigChainState{
				Id:     teamID,
				Public: public,
			},
		}

		res, _, _ := st.Get(mctx, teamID, public)
		require.Nil(t, res)
		st.Put(mctx, &obj)
		t.Logf("throwing out mem storage")
		st.ClearMem()
		res, _, _ = st.Get(mctx, teamID, public)
		require.NotNil(t, res, "cache miss")
		require.False(t, res == &obj, "should be the a different object read from disk")
		require.Equal(t, teamID, res.Chain.Id)
		require.Equal(t, public, res.Chain.Public)
	}
}

// Switching users should render other user's cache inaccessible.
func TestStorageLogout(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	for _, public := range []bool{false, true} {
		teamID := NewSubteamID(false /*public*/)
		st := getStorageFromG(tc.G)
		obj := keybase1.TeamData{
			Chain: keybase1.TeamSigChainState{
				Id:     teamID,
				Public: public,
			},
		}
		mctx := libkb.NewMetaContextForTest(tc)
		st.Put(mctx, &obj)
		res, _, _ := st.Get(mctx, teamID, public)
		require.NotNil(t, res, "cache miss")
		require.True(t, res == &obj, "should be the same obj from mem")

		t.Logf("logout")
		tc.G.Logout(context.TODO())

		require.Equal(t, 0, st.MemSize(), "mem cache still populated")

		res, _, _ = st.Get(mctx, teamID, public)
		require.Nil(t, res, "got from cache, but should be gone")

		t.Logf("login as someone else")
		_, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
		require.NoError(t, err)

		res, _, _ = st.Get(mctx, teamID, public)
		require.Nil(t, res, "got from cache, but should be gone")
	}
}

func TestStorageUpdate(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	for _, public := range []bool{false, true} {
		_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
		require.NoError(t, err)

		teamID := NewSubteamID(false /*public*/)
		st := getStorageFromG(tc.G)

		t.Logf("store 1")
		team := &keybase1.TeamData{
			Chain: keybase1.TeamSigChainState{
				Id:     teamID,
				Public: public,
			},
			CachedAt: keybase1.ToTime(tc.G.Clock().Now()),
		}
		mctx := libkb.NewMetaContextForTest(tc)
		st.Put(mctx, team)

		t.Logf("get 1")
		team, _, _ = st.Get(mctx, teamID, public)
		require.NotNil(t, team)

		t.Logf("store updated")
		t.Logf("cache  pre-set cachedAt:%v", team.CachedAt.Time())
		newTime := keybase1.ToTime(tc.G.Clock().Now().Add(freshnessLimit * -2)).Time()
		require.False(t, newTime.Equal(team.CachedAt.Time()))
		team.CachedAt = keybase1.ToTime(newTime)
		t.Logf("cache post-set cachedAt:%v", team.CachedAt.Time())
		require.True(t, newTime.Equal(team.CachedAt.Time()), "%v != %v", newTime, team.CachedAt.Time())

		t.Logf("get updated")
		team, _, _ = st.Get(mctx, teamID, public)
		require.NotNil(t, team)

		require.True(t, newTime.Equal(team.CachedAt.Time()))
	}
}
