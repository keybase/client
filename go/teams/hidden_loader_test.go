package teams

import (
	"testing"
	"time"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/teams/hidden"

	"github.com/keybase/clockwork"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/stretchr/testify/require"
)

func makeHiddenRotation(t *testing.T, userContext *libkb.GlobalContext, teamName keybase1.TeamName) {
	team, err := GetForTestByStringName(context.TODO(), userContext, teamName.String())
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)
}

func loadTeamAndAssertCommittedAndUncommittedSeqnos(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID, committedSeqno, uncommittedSeqno keybase1.Seqno) {
	_, teamHiddenChain, err := tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, committedSeqno, teamHiddenChain.LastCommittedSeqno, "committed seqno")
	require.Equal(t, uncommittedSeqno, teamHiddenChain.Last, "committed seqno")
}

func assertHiddenMerkleErrorType(t *testing.T, err error, expType libkb.HiddenMerkleErrorType) {
	require.Error(t, err)
	require.IsType(t, libkb.HiddenMerkleError{}, err)
	require.Equal(t, err.(libkb.HiddenMerkleError).ErrorType(), expType)
}

func checkHiddenMerkleErrorType(t *testing.T, err error, expType libkb.HiddenMerkleErrorType) bool {
	if err == nil {
		t.Logf("nil err")
		return false
	}
	if e, ok := err.(libkb.HiddenMerkleError); !ok || e.ErrorType() != expType {
		t.Logf("err has the wrong type (opr the wrong HiddenMerkleErrorType): %+v (expected %v)", err, expType)
		return false
	}
	return true
}

func loadTeamAndCheckCommittedAndUncommittedSeqnos(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID, committedSeqno, uncommittedSeqno keybase1.Seqno) bool {
	_, teamHiddenChain, err := tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	if committedSeqno != teamHiddenChain.LastCommittedSeqno {
		t.Logf("Error: committedSeqno != teamHiddenChain.LastCommittedSeqno: %v != %v ", committedSeqno, teamHiddenChain.LastCommittedSeqno)
		return false
	}
	if uncommittedSeqno != teamHiddenChain.Last {
		t.Logf("Error: uncommittedSeqno != teamHiddenChain.Last: %v != %v ", uncommittedSeqno, teamHiddenChain.Last)
		return false
	}
	return true
}

func loadTeamAndAssertUncommittedSeqno(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID, uncommittedSeqno keybase1.Seqno) {
	_, teamHiddenChain, err := tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, uncommittedSeqno, teamHiddenChain.Last)
}

func loadTeamAndAssertNoHiddenChainExists(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID) {
	teamChain, teamHiddenChain, err := tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.NotNil(t, teamChain)
	require.Nil(t, teamHiddenChain)
}

func getCurrentBlindRootHashFromMerkleRoot(t *testing.T, tc libkb.TestContext) string {
	apiRes, err := tc.G.API.Get(libkb.NewMetaContextForTest(tc), libkb.APIArg{
		Endpoint: "merkle/root",
	})
	require.NoError(t, err)
	payloadStr, err := apiRes.Body.AtKey("payload_json").GetString()
	require.NoError(t, err)
	payload, err := jsonw.Unmarshal([]byte(payloadStr))
	require.NoError(t, err)
	blindRoot, err := payload.AtKey("body").AtKey("blind_merkle_root_hash").GetString()
	require.NoError(t, err)

	return blindRoot
}

func requestNewBlindTreeFromArchitectAndWaitUntilDone(t *testing.T, uTc *libkb.TestContext) {
	oldBlindRoot := getCurrentBlindRootHashFromMerkleRoot(t, *uTc)

	// make the architect run. This returns when the architect has finished a round
	_, err := uTc.G.API.Get(libkb.NewMetaContextForTest(*uTc), libkb.APIArg{
		Endpoint: "test/build_blind_tree",
	})
	require.NoError(t, err)

	// the user adds a paper key to make new main merkle tree version.
	uis := libkb.UIs{
		LogUI:    uTc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := engine.NewPaperKey(uTc.G)
	err = engine.RunEngine2(libkb.NewMetaContextForTest(*uTc).WithUIs(uis), eng)
	require.NoError(t, err)

	// ensure the architect actually updated
	newBlindRoot := getCurrentBlindRootHashFromMerkleRoot(t, *uTc)
	require.NotEqual(t, oldBlindRoot, newBlindRoot)
}

func retryTestNTimes(t *testing.T, n int, f func(t *testing.T) bool) {
	for i := 0; i < n; i++ {
		succeeded := f(t)
		if succeeded {
			t.Logf("Succeeded!")
			return
		}
	}
	t.Fail()
}
func TestHiddenLoadFailsIfServerDoesntCommitLinks(t *testing.T) {
	retryTestNTimes(t, 5, testHiddenLoadFailsIfServerDoesntCommitLinks)
}

func testHiddenLoadFailsIfServerDoesntCommitLinks(t *testing.T) bool {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	clock := clockwork.NewFakeClock()
	tcs[1].G.SetClock(clock)

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// There have been no hidden rotations yet.
	loadTeamAndAssertNoHiddenChainExists(t, tcs[1], teamID)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamAndAssertUncommittedSeqno(t, tcs[1], teamID, 1)

	// make the architect run
	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[0])

	loadTeamAndAssertCommittedAndUncommittedSeqnos(t, tcs[1], teamID, 1, 1)

	// make another hidden rotation
	makeHiddenRotation(t, tcs[0].G, teamName)

	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	if !loadTeamAndCheckCommittedAndUncommittedSeqnos(t, tcs[1], teamID, 1, 2) {
		return false
	}

	// now, move the clock forward and reload. The hidden loader should complain about seqno 2 not being committed
	clock.Advance(3 * 24 * time.Hour)
	tcs[1].G.SetClock(clock)
	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})

	return checkHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorOldLinkNotYetCommitted)
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

	// There have been no hidden rotations yet.
	loadTeamAndAssertNoHiddenChainExists(t, tcs[1], teamID)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamAndAssertUncommittedSeqno(t, tcs[1], teamID, 1)

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
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorRollbackUncommittedSeqno)
}

func TestHiddenLoadFailsIfServerDoesNotReturnPromisedLinks(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// There have been no hidden rotations yet.
	loadTeamAndAssertNoHiddenChainExists(t, tcs[1], teamID)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamAndAssertUncommittedSeqno(t, tcs[1], teamID, 1)

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
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorServerWitholdingLinks)
}

func TestHiddenLoadFailsIfHiddenTailIsTamperedAfterFirstLoad(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// There have been no hidden rotations yet.
	loadTeamAndAssertNoHiddenChainExists(t, tcs[1], teamID)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamAndAssertUncommittedSeqno(t, tcs[1], teamID, 1)

	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[0])

	loadTeamAndAssertCommittedAndUncommittedSeqnos(t, tcs[1], teamID, 1, 1)

	// now load the team again, but this time we change the response from the server by altering the response type
	teamLoader := tcs[1].G.GetTeamLoader().(*TeamLoader)
	defaultWorld := teamLoader.world
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.RespType = 111
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(teamLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorInvalidHiddenResponseType)

	// now load the team again, but this time we change the response from the server by altering the hidden tail
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
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorInconsistentUncommittedSeqno)

	// now load the team again, but this time we change the response from the server by altering the hidden tail hash
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
	require.IsType(t, hidden.RatchetError{}, err)

	// now load the team again, but this time we change the response from the server into an absence proof
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.RespType = libkb.MerkleHiddenResponseTypeABSENCEPROOF
				hiddenResp.CommittedHiddenTail = nil
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(teamLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorUnexpectedAbsenceProof)

	// now load the team again, but this time we change the response from the server by altering the hidden response type
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
	require.IsType(t, libkb.HiddenChainDataMissingError{}, err)

	makeHiddenRotation(t, tcs[0].G, teamName)
	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[0])
	teamLoader.world = defaultWorld
	tcs[1].G.SetTeamLoader(teamLoader)
	loadTeamAndAssertCommittedAndUncommittedSeqnos(t, tcs[1], teamID, 2, 2)

	// now load the team again, but this time we change the response from the server by rolling back the uncommitted seqno
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.CommittedHiddenTail.Seqno = 1
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetTeamLoader(teamLoader)

	_, _, err = tcs[1].G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorRollbackCommittedSeqno)
}

func TestHiddenLoadFailsIfHiddenTailIsTamperedBeforeFirstLoad(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B and C to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[2].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// There have been no hidden rotations yet.
	loadTeamAndAssertNoHiddenChainExists(t, tcs[1], teamID)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamAndAssertUncommittedSeqno(t, tcs[1], teamID, 1)

	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[0])

	loadTeamAndAssertCommittedAndUncommittedSeqnos(t, tcs[1], teamID, 1, 1)

	// now load the team again (using a fresh user), but this time we alter the
	// hidden tail hash returned by the server
	teamLoader := tcs[2].G.GetTeamLoader().(*TeamLoader)
	defaultWorld := teamLoader.world
	teamLoader.world = CorruptingMockLoaderContext{
		LoaderContext: defaultWorld,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.CommittedHiddenTail.Hash[0] ^= 0xff
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[2].G.SetTeamLoader(teamLoader)

	_, _, err = teamLoader.Load(context.TODO(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.IsType(t, hidden.LoaderError{}, err)
	require.Contains(t, err.Error(), "link ID at 1 fails to check against ratchet")
}

func loadTeamFTLAndAssertName(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID, teamName keybase1.TeamName) {
	res, err := tc.G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tc), keybase1.FastTeamLoadArg{
		ID:           teamID,
		ForceRefresh: true,
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
}

func loadTeamFTLAndAssertGeneration(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID, teamName keybase1.TeamName, perTeamKeyGeneration int) {
	res, err := tc.G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tc), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(perTeamKeyGeneration)},
	})
	require.NoError(t, err)
	require.Equal(t, res.Name.String(), teamName.String())
	require.Equal(t, 1, len(res.ApplicationKeys))
	require.EqualValues(t, perTeamKeyGeneration, res.ApplicationKeys[0].KeyGeneration)
}

func loadTeamFTLAndAssertGenerationUnavailable(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID, perTeamKeyGeneration int) {
	_, err := tc.G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tc), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(perTeamKeyGeneration)},
	})
	require.Error(t, err)
	require.IsType(t, FTLMissingSeedError{}, err)
}

func loadTeamFTLAndAssertMaxGeneration(t *testing.T, tc *libkb.TestContext, teamID keybase1.TeamID, teamName keybase1.TeamName, perTeamKeyGeneration int) {
	loadTeamFTLAndAssertGeneration(t, tc, teamID, teamName, perTeamKeyGeneration)
	loadTeamFTLAndAssertGenerationUnavailable(t, tc, teamID, perTeamKeyGeneration+1)
}

func TestFTLFailsIfServerDoesntCommitLinks(t *testing.T) {
	retryTestNTimes(t, 5, testFTLFailsIfServerDoesntCommitLinks)
}

func testFTLFailsIfServerDoesntCommitLinks(t *testing.T) bool {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	clock := clockwork.NewFakeClock()
	tcs[1].G.SetClock(clock)

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	loadTeamFTLAndAssertName(t, tcs[1], teamID, teamName)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 2)

	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[0])

	// make another hidden rotation
	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 3)

	// now, move the clock forward and reload. The hidden loader should complain about hidden seqno 2 not being committed
	clock.Advance(3 * 24 * time.Hour)
	tcs[1].G.SetClock(clock)
	_, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(3)},
	})

	// This has the potential to flake, if the architect runs concurrently and does make a new blind tree version.
	return checkHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorOldLinkNotYetCommitted)
}

func TestFTLFailsIfServerRollsbackUncommittedSeqno(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 1)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 2)

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

	_, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorRollbackUncommittedSeqno)
}

func TestFTLFailsIfServerDoesNotReturnPromisedLinks(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 1)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 2)

	makeHiddenRotation(t, tcs[0].G, teamName)

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

	_, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(3)},
	})
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorServerWitholdingLinks)
}

func TestFTLFailsIfHiddenTailIsTamperedAfterFirstLoad(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 1)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 2)

	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[0])

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 2)

	// now load the team again, but this time we change the response from the server by altering the hidden tail
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

	_, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorInconsistentUncommittedSeqno)

	// now load the team again, but this time we change the response from the server by altering the hidden tail hash
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

	_, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.IsType(t, hidden.RatchetError{}, err)

	// now load the team again, but this time we change the response type of the server
	ftl.world = CorruptingMockLoaderContext{
		LoaderContext: world,
		merkleCorruptorFunc: func(r1 keybase1.Seqno, r2 keybase1.LinkID, hiddenResp *libkb.MerkleHiddenResponse, err error) (keybase1.Seqno, keybase1.LinkID, *libkb.MerkleHiddenResponse, error) {
			if hiddenResp != nil {
				hiddenResp.RespType = libkb.MerkleHiddenResponseTypeABSENCEPROOF
				hiddenResp.CommittedHiddenTail = nil
			}
			return r1, r2, hiddenResp, err
		},
	}
	tcs[1].G.SetFastTeamLoader(ftl)

	_, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	assertHiddenMerkleErrorType(t, err, libkb.HiddenMerkleErrorUnexpectedAbsenceProof)

	// now load the team again, but this time we change the response from the server by altering the response type
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

	_, err = tcs[1].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[1]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.IsType(t, libkb.HiddenChainDataMissingError{}, err)
}

func TestFTLFailsIfHiddenTailIsTamperedBeforeFirstLoad(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("add B and C to the team so they can load it")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[2].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 1)

	makeHiddenRotation(t, tcs[0].G, teamName)

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 2)

	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[0])

	loadTeamFTLAndAssertMaxGeneration(t, tcs[1], teamID, teamName, 2)

	ftl := tcs[2].G.GetFastTeamLoader().(*FastTeamChainLoader)
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
	tcs[2].G.SetFastTeamLoader(ftl)

	_, err = tcs[2].G.GetFastTeamLoader().Load(libkb.NewMetaContextForTest(*tcs[2]), keybase1.FastTeamLoadArg{
		ID:                   teamID,
		ForceRefresh:         true,
		Applications:         []keybase1.TeamApplication{keybase1.TeamApplication_CHAT},
		KeyGenerationsNeeded: []keybase1.PerTeamKeyGeneration{keybase1.PerTeamKeyGeneration(2)},
	})
	require.Error(t, err)
	require.IsType(t, hidden.LoaderError{}, err)
	require.Contains(t, err.Error(), "link ID at 1 fails to check against ratchet")
}
