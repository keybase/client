package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

// See CORE-8860. We should be able to audit a stale team. That is, ever the merkle tree
// is advertising a tail at 5, and we're only loaded through 3 (due to an unbusted cache),
// the audit should still succeed.
func TestAuditStaleTeam(t *testing.T) {

	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("create team")
	teamName, _ := createTeam2(*tcs[0])
	m := make([]libkb.MetaContext, 3)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}

	// We set up codenames for 3 users, A, B and C
	const (
		A = 0
		B = 1
		C = 2
	)

	t.Logf("A adds B to the team as an admin")
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	load := func(asUser int) {
		_, err = Load(m[asUser].Ctx(), tcs[asUser].G, keybase1.LoadTeamArg{
			Name:    teamName.String(),
			Public:  false,
			StaleOK: true,
		})
		require.NoError(t, err)
	}

	addC := func(asUser int) {
		_, err = AddMember(m[asUser].Ctx(), tcs[asUser].G, teamName.String(), fus[2].Username, keybase1.TeamRole_READER)
		require.NoError(t, err)
	}

	rmC := func(asUser int) {
		err = RemoveMember(m[asUser].Ctx(), tcs[asUser].G, teamName.String(), fus[2].Username)
		require.NoError(t, err)
	}

	setFastAudits := func() {
		// do a lot of probes so we're likely to find issues
		devParams.NumPostProbes = 10
		devParams.MerkleMovementTrigger = keybase1.Seqno(1)
		devParams.RootFreshness = time.Duration(1)
	}

	setSlowAudits := func() {
		devParams.NumPostProbes = 1
		devParams.MerkleMovementTrigger = keybase1.Seqno(1000000)
		devParams.RootFreshness = time.Hour
	}

	// A adds C to the team and triggers an Audit
	setFastAudits()
	addC(A)

	// A removes C from the team, and loads the team, but does *not* trigger an audit
	setSlowAudits()
	rmC(A)
	load(A)

	t.Logf("User B rotates the key a bunch of times")

	// B rotates the key by adding and remove C a bunch of times.
	for i := 0; i < 3; i++ {
		addC(B)
		rmC(B)
	}

	// A forces local idea of what the max merkle sequence number is.
	_, err = tcs[A].G.MerkleClient.FetchRootFromServerBySeqno(m[0], keybase1.Seqno(100000000))
	require.NoError(t, err)

	// A forces an audit on a stale team.
	setFastAudits()
	t.Logf("User A loading the team, and auditing on an primed cached")
	load(A)
}
