package teams

import (
	"context"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams/hidden"
	"github.com/stretchr/testify/require"
)

// Test getting the merkle leaf from the server.
// This is a test of MerkleClient.
func TestMerkle(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name := createTeam(tc)

	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)

	leaf, err := tc.G.MerkleClient.LookupTeam(libkb.NewMetaContextForTest(tc), team.ID)
	require.NoError(t, err)
	require.NotNil(t, leaf)
	t.Logf("team merkle leaf: %v", spew.Sdump(leaf))
	if leaf.TeamID.IsNil() {
		t.Fatalf("nil teamID; likely merkle hasn't yet published and polling is busted")
	}
	require.Equal(t, team.ID, leaf.TeamID, "team id")
	require.Equal(t, team.chain().GetLatestSeqno(), leaf.Private.Seqno)
	require.Equal(t, team.chain().GetLatestLinkID(), leaf.Private.LinkID.Export())
	// leaf.Private.SigID not checked
	require.Nil(t, leaf.Public, "team public leaf")
}

func TestMerkleWithHidden(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	u, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name := createTeam(tc)

	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)

	leaf, hiddenResp, err := tc.G.MerkleClient.LookupTeamWithHidden(libkb.NewMetaContextForTest(tc), team.ID, hidden.ProcessHiddenResponseFunc)
	require.NoError(t, err)
	require.NotNil(t, leaf)
	t.Logf("team merkle leaf: %v", spew.Sdump(leaf))
	if leaf.TeamID.IsNil() {
		t.Fatalf("nil teamID; likely merkle hasn't yet published and polling is busted")
	}
	require.Equal(t, team.ID, leaf.TeamID, "team id")
	require.Equal(t, team.chain().GetLatestSeqno(), leaf.Private.Seqno)
	require.Equal(t, team.chain().GetLatestLinkID(), leaf.Private.LinkID.Export())
	// leaf.Private.SigID not checked
	require.Nil(t, leaf.Public, "team public leaf")
	require.Equal(t, libkb.MerkleHiddenResponseTypeABSENCEPROOF, hiddenResp.RespType)
	require.EqualValues(t, 0, hiddenResp.UncommittedSeqno)
	require.Nil(t, hiddenResp.CommittedHiddenTail)

	// make a hidden rotation to later check that merkle/path returns the appropriate result
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)
	// reload the team after the hidden rotation
	team, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)

	leaf, hiddenResp, err = tc.G.MerkleClient.LookupTeamWithHidden(libkb.NewMetaContextForTest(tc), team.ID, hidden.ProcessHiddenResponseFunc)
	require.NoError(t, err)
	require.NotNil(t, leaf)
	require.Equal(t, team.ID, leaf.TeamID, "team id mismatch")
	require.Equal(t, team.chain().GetLatestSeqno(), leaf.Private.Seqno)
	require.Equal(t, team.chain().GetLatestLinkID(), leaf.Private.LinkID.Export())
	require.True(t, hiddenResp.RespType == libkb.MerkleHiddenResponseTypeABSENCEPROOF || hiddenResp.RespType == libkb.MerkleHiddenResponseTypeOK)
	require.EqualValues(t, 1, hiddenResp.UncommittedSeqno)
	if hiddenResp.RespType == libkb.MerkleHiddenResponseTypeABSENCEPROOF {
		t.Logf("The hidden rotation was not yet committed to the blind tree. This is expected.")
		require.Nil(t, hiddenResp.CommittedHiddenTail)
	} else {
		//  This can happen if the architect concurrently builds a new tree
		t.Logf("Surprisingly, the hidden chain was already committed to the blind tree.")
		require.NotNil(t, team.HiddenChain(), "NIL hidden chain")
		committedHiddenTail := hiddenResp.CommittedHiddenTail
		require.Equal(t, team.HiddenChain().TailTriple().Seqno, committedHiddenTail.Seqno)
		require.EqualValues(t, team.HiddenChain().TailTriple().LinkID, committedHiddenTail.Hash.String())
		require.Equal(t, team.HiddenChain().TailTriple().SeqType, committedHiddenTail.ChainType)
	}

	// ask blindarchitectd to build a new tree
	_, err = tc.G.API.Get(tc.MetaContext(), libkb.APIArg{
		Endpoint: "test/build_blind_tree",
	})
	require.NoError(t, err)

	committed := false
	for i := 0; i < 5; i++ {
		// create a new user to force the main tree to create a new version as well
		_, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
		require.NoError(t, err)
		err = tc.Logout()
		require.NoError(t, err)
		err = u.Login(tc.G)
		require.NoError(t, err)

		leaf, hiddenResp, err = tc.G.MerkleClient.LookupTeamWithHidden(libkb.NewMetaContextForTest(tc), team.ID, hidden.ProcessHiddenResponseFunc)
		require.NoError(t, err)
		require.NotNil(t, leaf)
		require.Equal(t, team.ID, leaf.TeamID, "team id")
		require.Equal(t, team.chain().GetLatestSeqno(), leaf.Private.Seqno)
		require.Equal(t, team.chain().GetLatestLinkID(), leaf.Private.LinkID.Export())
		require.True(t, hiddenResp.RespType == libkb.MerkleHiddenResponseTypeABSENCEPROOF || hiddenResp.RespType == libkb.MerkleHiddenResponseTypeOK)
		require.EqualValues(t, 1, hiddenResp.UncommittedSeqno)

		if hiddenResp.RespType == libkb.MerkleHiddenResponseTypeABSENCEPROOF {
			t.Logf("The hidden rotation was not committed yet...")
			require.Nil(t, hiddenResp.CommittedHiddenTail)
			time.Sleep(5 * time.Second)
			continue
		}

		t.Logf("The hidden rotation was committed!")
		require.NotNil(t, team.HiddenChain(), "NIL hidden chain")
		committedHiddenTail := hiddenResp.CommittedHiddenTail
		require.Equal(t, team.HiddenChain().TailTriple().Seqno, committedHiddenTail.Seqno)
		require.EqualValues(t, team.HiddenChain().TailTriple().LinkID, committedHiddenTail.Hash.String())
		require.Equal(t, team.HiddenChain().TailTriple().SeqType, committedHiddenTail.ChainType)
		committed = true
		break
	}

	if !committed {
		t.Error("The hidden rotation was not committed to the blind tree")
	}
}
