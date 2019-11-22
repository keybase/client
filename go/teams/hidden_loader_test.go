package teams

import (
	"testing"
	"time"

	"github.com/keybase/clockwork"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/stretchr/testify/require"
)

func TestHiddenLoadFailsIfServerDoesntCommitLinks(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	clock := clockwork.NewFakeClock()
	tcs[1].G.SetClock(clock)

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	teamChain, teamHiddenChain, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.NotNil(t, teamChain)
	// There have been no hidden rotations yet.
	require.Nil(t, teamHiddenChain)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	require.Equal(t, keybase1.Seqno(0), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

	// make the architect run
	_, err = tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "test/build_blind_tree",
	})
	require.NoError(t, err)

	committed := false
	for i := 0; i < 5; i++ {
		// create a new user to force the main tree to create a new version as well
		_, err := kbtest.CreateAndSignupFakeUser("teamH", tcs[2].G)
		require.NoError(t, err)

		_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

		if teamHiddenChain.LastCommittedSeqno == keybase1.Seqno(0) {
			t.Logf("The hidden rotation was not committed yet... %v", i)
			time.Sleep(3 * time.Second)
			continue
		}

		t.Logf("The hidden rotation was committed!")
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.LastCommittedSeqno, "committed seqno")
		committed = true
		break
	}
	require.True(t, committed, "hidden rotation wasn't committed")

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

	// make another hidden rotation
	team, err = GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(2), teamHiddenChain.Last, "uncommitted seqno")

	// now, move the clock forward and reload. The hidden loader should complain about seqno 2 not being committed
	clock.Advance(3 * 24 * time.Hour)
	tcs[1].G.SetClock(clock)
	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	require.Contains(t, err.Error(), "Link for seqno 2 was added 72h0m0s ago and has not been included in the blind tree yet.")
}

type CorruptingMockLoaderContext struct {
	LoaderContext

	merkleCorruptorFunc func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error)
}

func (c CorruptingMockLoaderContext) merkleLookupWithHidden(ctx context.Context, teamID keybase1.TeamID, public bool) (r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) {
	return c.merkleCorruptorFunc(c.LoaderContext.merkleLookupWithHidden(ctx, teamID, public))
}

var _ LoaderContext = CorruptingMockLoaderContext{}

func TestHiddenLoadFailsIfServerRollsbackUncommittedSeqno(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	teamChain, teamHiddenChain, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.NotNil(t, teamChain)
	// There have been no hidden rotations yet.
	require.Nil(t, teamHiddenChain)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	require.Equal(t, keybase1.Seqno(0), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

	// now load the team again, but this time we change the response of the server to rollback the number of committed sequence numbers
	newLoader := tcs[1].G.GetTeamLoader()
	newLoader.(*TeamLoader).world = CorruptingMockLoaderContext{
		LoaderContext: newLoader.(*TeamLoader).world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil && hiddenResp.UncommittedSeqno >= 1 {
				hiddenResp.UncommittedSeqno--
				t.Logf("Simulating malicious server: updating hiddenResp.UncommittedSeqno (new value %v)", hiddenResp.UncommittedSeqno)
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(newLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "The server indicated that the last hidden link has Seqno 0, but we knew of a link with seqno 1 already!")
}

func TestHiddenLoadFailsIfServerDoesNotReturnPromisedLinks(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	teamChain, teamHiddenChain, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.NotNil(t, teamChain)
	// There have been no hidden rotations yet.
	require.Nil(t, teamHiddenChain)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	require.Equal(t, keybase1.Seqno(0), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

	// now load the team again, but this time we change the response of the server as if there were more hidden links
	newLoader := tcs[1].G.GetTeamLoader()
	newLoader.(*TeamLoader).world = CorruptingMockLoaderContext{
		LoaderContext: newLoader.(*TeamLoader).world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil && hiddenResp.UncommittedSeqno >= 1 {
				hiddenResp.UncommittedSeqno += 5
				t.Logf("Simulating malicious server: updating hiddenResp.UncommittedSeqno (new value %v)", hiddenResp.UncommittedSeqno)
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(newLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "Seqno 6 is not part of this chain (last is 1)")
}

func TestHiddenLoadFailsIfHiddenTailIsTamperedAfterFirstLoad(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	teamChain, teamHiddenChain, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.NotNil(t, teamChain)
	// There have been no hidden rotations yet.
	require.Nil(t, teamHiddenChain)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	require.Equal(t, keybase1.Seqno(0), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

	// make the architect run
	_, err = tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "test/build_blind_tree",
	})
	require.NoError(t, err)

	committed := false
	for i := 0; i < 10; i++ {
		// create a new user to force the main tree to create a new version as well
		_, err := kbtest.CreateAndSignupFakeUser("teamH", tcs[2].G)
		require.NoError(t, err)

		_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

		if teamHiddenChain.LastCommittedSeqno == keybase1.Seqno(0) {
			t.Logf("The hidden rotation was not committed yet... %v", i)
			time.Sleep(3 * time.Second)
			continue
		}

		t.Logf("The hidden rotation was committed!")
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.LastCommittedSeqno, "committed seqno")
		committed = true
		break
	}
	require.True(t, committed, "hidden rotation wasn't committed")

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

	// now load the team again, but this time we change the response of the server and change the hidden tail
	teamLoader := tcs[1].G.GetTeamLoader().(*TeamLoader)
	defaultWorld := teamLoader.world
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.CommittedHiddenTail.Seqno += 5
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(teamLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "The server claims that the lastHiddenSeqno for this team (seqno 1) is smaller than the one in the blind merkle update it sent (6)")

	// now load the team again, but this time we change the response of the server and change the hidden tail hash
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.CommittedHiddenTail.Hash[0] ^= 0xff
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(teamLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "hidden team ratchet error: bad ratchet, clashes existing pin")

	// now load the team again, but this time we change the response of the server and change the hidden tail hash
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.RespType = libkb.MerkleHiddenResponseTypeABSENCEPROOF
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(teamLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "Server claimed (and proved) there are no committed hidden chain links in the chain, but we had previously seen a committed link with seqno 1")

	// now load the team again, but this time we change the response of the server and change the hidden tail hash
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.RespType = libkb.MerkleHiddenResponseTypeNONE
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(teamLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "hidden chain data missing error: Not a restricted bot or recursive load, but the server did not return merkle hidden chain data")

}

func TestHiddenLoadFailsIfHiddenTailIsTamperedBeforeFirstLoad(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B and C to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[3].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	teamChain, teamHiddenChain, err := tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)
	require.NotNil(t, teamChain)
	// There have been no hidden rotations yet.
	require.Nil(t, teamHiddenChain)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	require.Equal(t, keybase1.Seqno(0), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

	// make the architect run
	_, err = tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "test/build_blind_tree",
	})
	require.NoError(t, err)

	committed := false
	for i := 0; i < 10; i++ {
		// create a new user to force the main tree to create a new version as well
		_, err := kbtest.CreateAndSignupFakeUser("teamH", tcs[2].G)
		require.NoError(t, err)

		_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
			ID:          teamID,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

		if teamHiddenChain.LastCommittedSeqno == keybase1.Seqno(0) {
			t.Logf("The hidden rotation was not committed yet... %v", i)
			time.Sleep(3 * time.Second)
			continue
		}

		t.Logf("The hidden rotation was committed!")
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")
		require.Equal(t, keybase1.Seqno(1), teamHiddenChain.LastCommittedSeqno, "committed seqno")
		committed = true
		break
	}
	require.True(t, committed, "hidden rotation wasn't committed")

	_, teamHiddenChain, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, keybase1.Seqno(1), teamHiddenChain.Last, "uncommitted seqno")

	// now load the team again (using a fresh user), but this time we change the response of the server and change the hidden tail
	teamLoader := tcs[3].G.GetTeamLoader().(*TeamLoader)
	defaultWorld := teamLoader.world
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				t.Logf("hiddenResp %v cit %v", hiddenResp, hiddenResp.CommittedHiddenTail)
				hiddenResp.CommittedHiddenTail.Hash[0] ^= 0xff
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[3].G.SetTeamLoader(teamLoader)

	_, _, err = teamLoader.Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "link ID at 1 fails to check against ratchet")
}

func TestFTLFailsIfServerDoesntCommitLinks(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	clock := clockwork.NewFakeClock()
	tcs[1].G.SetClock(clock)

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	res, err := tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:           teamID,
		ForceRefresh: true,
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	// create new user to make new main tree version.
	_, err = kbtest.CreateAndSignupFakeUser("team", tcs[2].G)
	require.NoError(t, err)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 2, res.ApplicationKeys[0].KeyGeneration)

	// ensure key generation 3 is not available
	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(3)},
	})
	require.Error(t, err)
	require.IsType(t, FTLMissingSeedError{}, err)

	apiRes, err := tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "merkle/root",
	})
	require.NoError(t, err)
	payloadStr, err := apiRes.Body.AtKey("payload_json").GetString()
	require.NoError(t, err)
	payload, err := jsonw.Unmarshal([]byte(payloadStr))
	require.NoError(t, err)
	oldBlindRoot, err := payload.AtKey("body").AtKey("blind_merkle_root_hash").GetString()
	require.NoError(t, err)

	// make the architect run
	_, err = tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "test/build_blind_tree",
	})
	require.NoError(t, err)

	// ensure the new blind tree is committed to the main tree. We make new users to trigger main tree rotations
	committed := false
	for i := 0; i < 10; i++ {
		// create a new user to force the main tree to create a new version as well
		_, err := kbtest.CreateAndSignupFakeUser("teamH", tcs[2].G)
		require.NoError(t, err)

		apiRes, err := tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
			Endpoint: "merkle/root",
		})
		require.NoError(t, err)
		payloadStr, err := apiRes.Body.AtKey("payload_json").GetString()
		require.NoError(t, err)
		payload, err := jsonw.Unmarshal([]byte(payloadStr))
		require.NoError(t, err)
		newBlindRoot, err := payload.AtKey("body").AtKey("blind_merkle_root_hash").GetString()
		require.NoError(t, err)

		if newBlindRoot == oldBlindRoot {
			t.Logf("The hidden rotation was not committed yet... %v", i)
			time.Sleep(3 * time.Second)
			continue
		}

		t.Logf("The hidden rotation was committed!")
		committed = true
		break
	}
	require.True(t, committed, "hidden rotation wasn't committed")

	// make another hidden rotation
	team, err = GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(3)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.True(t, len(res.ApplicationKeys) == 1)
	require.EqualValues(t, 3, res.ApplicationKeys[0].KeyGeneration)

	// now, move the clock forward and reload. The hidden loader should complain about hidden seqno 2 not being committed
	clock.Advance(3 * 24 * time.Hour)
	tcs[1].G.SetClock(clock)
	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(3)},
	})
	require.Error(t, err)
	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	require.Contains(t, err.Error(), "Link for seqno 2 was added 72h0m0s ago and has not been included in the blind tree yet.")
}

func TestFTLFailsIfServerRollsbackUncommittedSeqno(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	res, err := tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(1)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 1, res.ApplicationKeys[0].KeyGeneration)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 2, res.ApplicationKeys[0].KeyGeneration)

	// now load the team again, but this time we change the response of the server to rollback the number of committed sequence numbers
	newLoader := tcs[1].G.GetFastTeamLoader()
	newLoader.(*FastTeamChainLoader).world = CorruptingMockLoaderContext{
		LoaderContext: newLoader.(*FastTeamChainLoader).world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil && hiddenResp.UncommittedSeqno >= 1 {
				hiddenResp.UncommittedSeqno--
				t.Logf("Simulating malicious server: updating hiddenResp.UncommittedSeqno (new value %v)", hiddenResp.UncommittedSeqno)
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetFastTeamLoader(newLoader)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "The server indicated that the last hidden link has Seqno 0, but we knew of a link with seqno 1 already!")
}

func TestFTLFailsIfServerDoesNotReturnPromisedLinks(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	res, err := tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(1)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 1, res.ApplicationKeys[0].KeyGeneration)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.IsType(t, FTLMissingSeedError{}, err)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 2, res.ApplicationKeys[0].KeyGeneration)

	// make a hidden rotation
	team, err = GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	// now load the team again, but this time we change the response of the server as if there were more hidden links
	newLoader := tcs[1].G.GetFastTeamLoader()
	newLoader.(*FastTeamChainLoader).world = CorruptingMockLoaderContext{
		LoaderContext: newLoader.(*FastTeamChainLoader).world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil && hiddenResp.UncommittedSeqno >= 1 {
				hiddenResp.UncommittedSeqno += 5
				t.Logf("Simulating malicious server: updating hiddenResp.UncommittedSeqno (new value %v)", hiddenResp.UncommittedSeqno)
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetFastTeamLoader(newLoader)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(3)},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "Seqno 7 is not part of this chain (last is 2)")
}

func TestFTLFailsIfHiddenTailIsTamperedAfterFirstLoad(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	res, err := tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(1)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 1, res.ApplicationKeys[0].KeyGeneration)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.IsType(t, FTLMissingSeedError{}, err)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 2, res.ApplicationKeys[0].KeyGeneration)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(3)},
	})
	require.Error(t, err)
	require.IsType(t, FTLMissingSeedError{}, err)

	apiRes, err := tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "merkle/root",
	})
	require.NoError(t, err)
	payloadStr, err := apiRes.Body.AtKey("payload_json").GetString()
	require.NoError(t, err)
	payload, err := jsonw.Unmarshal([]byte(payloadStr))
	require.NoError(t, err)
	oldBlindRoot, err := payload.AtKey("body").AtKey("blind_merkle_root_hash").GetString()
	require.NoError(t, err)

	// make the architect run
	_, err = tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "test/build_blind_tree",
	})
	require.NoError(t, err)

	// ensure the new blind tree is committed to the main tree. We make new users to trigger main tree rotations
	committed := false
	for i := 0; i < 10; i++ {
		// create a new user to force the main tree to create a new version as well
		_, err := kbtest.CreateAndSignupFakeUser("teamH", tcs[2].G)
		require.NoError(t, err)

		apiRes, err := tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
			Endpoint: "merkle/root",
		})
		require.NoError(t, err)
		payloadStr, err := apiRes.Body.AtKey("payload_json").GetString()
		require.NoError(t, err)
		payload, err := jsonw.Unmarshal([]byte(payloadStr))
		require.NoError(t, err)
		newBlindRoot, err := payload.AtKey("body").AtKey("blind_merkle_root_hash").GetString()
		require.NoError(t, err)

		if newBlindRoot == oldBlindRoot {
			t.Logf("The hidden rotation was not committed yet... %v", i)
			time.Sleep(3 * time.Second)
			continue
		}

		t.Logf("The hidden rotation was committed!")
		committed = true
		break
	}
	require.True(t, committed, "hidden rotation wasn't committed")

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 2, res.ApplicationKeys[0].KeyGeneration)

	// now load the team again, but this time we change the response of the server and change the hidden tail
	ftl := tcs[1].G.GetFastTeamLoader().(*FastTeamChainLoader)
	world := ftl.world
	ftl.world = CorruptingMockLoaderContext{
		LoaderContext: world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.CommittedHiddenTail.Seqno += 5
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetFastTeamLoader(ftl)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "The server claims that the lastHiddenSeqno for this team (seqno 1) is smaller than the one in the blind merkle update it sent (6)")

	// now load the team again, but this time we change the response of the server and change the hidden tail hash
	ftl.world = CorruptingMockLoaderContext{
		LoaderContext: world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.CommittedHiddenTail.Hash[0] ^= 0xff
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetFastTeamLoader(ftl)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "hidden team ratchet error: Ratchet failed to match a currently accepted chainlink")

	// now load the team again, but this time we change the response of the server and change the hidden tail hash
	ftl.world = CorruptingMockLoaderContext{
		LoaderContext: world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.RespType = libkb.MerkleHiddenResponseTypeABSENCEPROOF
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetFastTeamLoader(ftl)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "Server claimed (and proved) there are no committed hidden chain links in the chain, but we had previously seen a committed link with seqno 1")

	// now load the team again, but this time we change the response of the server and change the proof type
	ftl.world = CorruptingMockLoaderContext{
		LoaderContext: world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.RespType = libkb.MerkleHiddenResponseTypeNONE
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetFastTeamLoader(ftl)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "hidden chain data missing error: the server did not return the necessary hidden chain data")
}

func TestFTLFailsIfHiddenTailIsTamperedBeforeFirstLoad(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B and C to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[3].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	res, err := tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(1)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 1, res.ApplicationKeys[0].KeyGeneration)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.IsType(t, FTLMissingSeedError{}, err)

	// make a hidden rotation
	team, err := GetForTestByStringName(context.TODO(), tcs[0].G, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 2, res.ApplicationKeys[0].KeyGeneration)

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(3)},
	})
	require.Error(t, err)
	require.IsType(t, FTLMissingSeedError{}, err)

	apiRes, err := tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "merkle/root",
	})
	require.NoError(t, err)
	payloadStr, err := apiRes.Body.AtKey("payload_json").GetString()
	require.NoError(t, err)
	payload, err := jsonw.Unmarshal([]byte(payloadStr))
	require.NoError(t, err)
	oldBlindRoot, err := payload.AtKey("body").AtKey("blind_merkle_root_hash").GetString()
	require.NoError(t, err)

	// make the architect run
	_, err = tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
		Endpoint: "test/build_blind_tree",
	})
	require.NoError(t, err)

	// ensure the new blind tree is committed to the main tree. We make new users to trigger main tree rotations
	committed := false
	for i := 0; i < 10; i++ {
		// create a new user to force the main tree to create a new version as well
		_, err := kbtest.CreateAndSignupFakeUser("teamH", tcs[2].G)
		require.NoError(t, err)

		apiRes, err := tcs[1].G.API.Get(libkb.NewMetaContextForTest(*tcs[1]), libkb.APIArg{
			Endpoint: "merkle/root",
		})
		require.NoError(t, err)
		payloadStr, err := apiRes.Body.AtKey("payload_json").GetString()
		require.NoError(t, err)
		payload, err := jsonw.Unmarshal([]byte(payloadStr))
		require.NoError(t, err)
		newBlindRoot, err := payload.AtKey("body").AtKey("blind_merkle_root_hash").GetString()
		require.NoError(t, err)

		if newBlindRoot == oldBlindRoot {
			t.Logf("The hidden rotation was not committed yet... %v", i)
			time.Sleep(3 * time.Second)
			continue
		}

		t.Logf("The hidden rotation was committed!")
		committed = true
		break
	}
	require.True(t, committed, "hidden rotation wasn't committed")

	res, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, 2, res.ApplicationKeys[0].KeyGeneration)

	ftl := tcs[3].G.GetFastTeamLoader().(*FastTeamChainLoader)
	world := ftl.world
	ftl.world = CorruptingMockLoaderContext{
		LoaderContext: world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				t.Logf("hiddenResp %v cit %v", hiddenResp, hiddenResp.CommittedHiddenTail)
				hiddenResp.CommittedHiddenTail.Hash[0] ^= 0xff
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[3].G.SetFastTeamLoader(ftl)

	res, err = tcs[3].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[3]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "link ID at 1 fails to check against ratchet")
}
