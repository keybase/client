package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Functions to help with testing the sigchain player where the inputs are
// sigchain links that are not necessarily created during normal client
// operation. Even though Keybase client doesn't generate such sigs, the player
// should be resilient against bad sigs error out, not putting team into bad
// state.

// NOTE: We are using "precheck" method here for two reasons:

// 1) We don't have to send the sigs to the server, making tests more efficient.

// 2) Usually these sigs would fail server verification as well. In this case
// we want to focus solely on sigchain player - it's fine if they do fail after
// serverside check, but that doesn't mean that similar check should not exist
// on the client side.

func makeTestSCTeamSection(team *Team) SCTeamSection {
	return SCTeamSection{
		ID:       SCTeamID(team.ID),
		Implicit: team.IsImplicit(),
		Public:   team.IsPublic(),
	}
}

func appendSigToState(t *testing.T, team *Team, state *TeamSigChainState,
	linkType libkb.LinkType, section SCTeamSection, me keybase1.UserVersion,
	merkleRoot *libkb.MerkleRoot) (*TeamSigChainState, error) {

	if state == nil {
		state = team.chain()
	}

	// Always make a copy here, call site shouldn't have to worry about that
	// when e.g. attempting to append multiple links to one base state to
	// excercise different errors.
	state = state.DeepCopyToPtr()

	sigMultiItem, _, err := team.sigTeamItemRaw(context.Background(), section,
		linkType, state.GetLatestSeqno()+1, state.GetLatestLinkID(), merkleRoot)
	if err != nil {
		return nil, err
	}

	newState, err := precheckLinksToState(context.Background(),
		team.G(), []libkb.SigMultiItem{sigMultiItem}, state, me)
	if err != nil {
		return nil, err
	}

	return newState, nil
}

// setupTestForPrechecks sets up a test context, creates a user, creates a
// team, and returns (tc, team, UV). Caller should call tc.Cleanup() after end
// of the test, e.g. through defer: `defer tc.Cleanup()`
func setupTestForPrechecks(t *testing.T, implicitTeam bool) (tc libkb.TestContext, team *Team, me keybase1.UserVersion) {
	tc = SetupTest(t, "team", 1)

	fus, err := kbtest.CreateAndSignupFakeUser("tprc", tc.G)
	require.NoError(t, err)

	if implicitTeam {
		team, _, _, err = LookupOrCreateImplicitTeam(context.Background(), tc.G, fus.Username, false /* public */)
		require.NoError(t, err)
	} else {
		teamname := createTeam(tc)
		team, err = Load(context.Background(), tc.G, keybase1.LoadTeamArg{
			Name:      teamname,
			NeedAdmin: true,
		})
		require.NoError(t, err)
	}

	// Prepare key-manager if we plan to do ChangeMembership links or similar.
	_, err = team.getKeyManager(context.TODO())
	require.NoError(t, err)

	me = tc.G.ActiveDevice.UserVersion()

	return tc, team, me
}

func requirePrecheckError(t *testing.T, err error) {
	require.Error(t, err)
	require.IsType(t, PrecheckAppendError{}, err)
}
