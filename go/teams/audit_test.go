package teams

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/sig3"
	"github.com/keybase/client/go/teams/hidden"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// See CORE-8860. We should be able to audit a stale team. That is, ever the merkle tree
// is advertising a tail at 5, and we're only loaded through 3 (due to an unbusted cache),
// the audit should still succeed.
func TestAuditStaleTeam(t *testing.T) {

	fus, tcs, cleanup := setupNTests(t, 5)
	defer cleanup()

	t.Logf("create team")
	teamName, _ := createTeam2(*tcs[0])
	m := make([]libkb.MetaContext, 5)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}

	// We set up codenames for 3 users, A, B, C, D and E
	const (
		A = 0
		B = 1
		C = 2
		D = 3
		E = 4
	)

	t.Logf("A adds B to the team as an admin")
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_ADMIN, nil)
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
		_, err = AddMember(m[asUser].Ctx(), tcs[asUser].G, teamName.String(), fus[C].Username, keybase1.TeamRole_READER, nil)
		require.NoError(t, err)
	}

	addD := func(asUser int) {
		_, err = AddMember(m[asUser].Ctx(), tcs[asUser].G, teamName.String(), fus[D].Username, keybase1.TeamRole_BOT, nil)
		require.NoError(t, err)
	}

	addE := func(asUser int) {
		_, err = AddMember(m[asUser].Ctx(), tcs[asUser].G, teamName.String(), fus[E].Username, keybase1.TeamRole_RESTRICTEDBOT, &keybase1.TeamBotSettings{})
		require.NoError(t, err)
	}

	rmC := func(asUser int) {
		err = RemoveMember(m[asUser].Ctx(), tcs[asUser].G, teamName.String(), fus[C].Username)
		require.NoError(t, err)
	}

	rmD := func(asUser int) {
		err = RemoveMember(m[asUser].Ctx(), tcs[asUser].G, teamName.String(), fus[D].Username)
		require.NoError(t, err)
	}

	rmE := func(asUser int) {
		err = RemoveMember(m[asUser].Ctx(), tcs[asUser].G, teamName.String(), fus[E].Username)
		require.NoError(t, err)
	}

	setFastAudits := func(m libkb.MetaContext) {
		// do a lot of probes so we're likely to find issues
		m.G().Env.Test.TeamAuditParams = &libkb.TeamAuditParams{
			NumPostProbes:         10,
			MerkleMovementTrigger: keybase1.Seqno(1),
			RootFreshness:         time.Duration(1),
			LRUSize:               500,
			NumPreProbes:          3,
			Parallelism:           3,
		}
	}

	setSlowAudits := func(m libkb.MetaContext) {
		m.G().Env.Test.TeamAuditParams = &libkb.TeamAuditParams{
			NumPostProbes:         1,
			MerkleMovementTrigger: keybase1.Seqno(1000000),
			RootFreshness:         time.Hour,
			LRUSize:               500,
			NumPreProbes:          3,
			Parallelism:           3,
		}
	}

	// A adds C, D and E to the team and triggers an Audit
	setFastAudits(m[A])
	addC(A)
	addD(A)
	addE(A)

	// A removes C, D and E from the team, and loads the team, but does *not* trigger an audit
	setSlowAudits(m[A])
	rmC(A)
	rmD(A)
	rmE(A)
	load(A)

	t.Logf("User B rotates the key a bunch of times")

	// B rotates the key by adding and remove C a bunch of times.
	for i := 0; i < 3; i++ {
		addC(B)
		rmC(B)
	}

	// A updates to the latest merkle root.
	_, err = tcs[A].G.MerkleClient.FetchRootFromServer(m[A], 0)
	require.NoError(t, err)

	// A forces an audit on a stale team.
	setFastAudits(m[A])
	t.Logf("User A loading the team, and auditing on an primed cached")
	load(A)
}

func TestAuditRotateAudit(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	m := make([]libkb.MetaContext, 4)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}

	// We set up codenames for 3 users, A, B, C, and D
	const (
		A = 0
		B = 1
		C = 2
		D = 3
	)

	load := func() {
		_, err := Load(m[A].Ctx(), tcs[A].G, keybase1.LoadTeamArg{
			Name:        teamName.String(),
			Public:      false,
			ForceRepoll: true,
		})
		require.NoError(t, err)
	}

	addB := func() keybase1.Seqno {
		_, err := AddMember(m[A].Ctx(), tcs[A].G, teamName.String(), fus[B].Username, keybase1.TeamRole_READER, nil)
		require.NoError(t, err)
		return 1
	}

	addC := func() keybase1.Seqno {
		_, err := AddMember(m[A].Ctx(), tcs[A].G, teamName.String(), fus[C].Username, keybase1.TeamRole_BOT, nil)
		require.NoError(t, err)
		return 1
	}

	addD := func() keybase1.Seqno {
		_, err := AddMember(m[A].Ctx(), tcs[A].G, teamName.String(), fus[D].Username, keybase1.TeamRole_RESTRICTEDBOT, &keybase1.TeamBotSettings{})
		require.NoError(t, err)
		// adding a RESTRICTEDBOT adds an additional bot_settings link
		return 2
	}

	rmB := func() keybase1.Seqno {
		err := RemoveMember(m[A].Ctx(), tcs[A].G, teamName.String(), fus[B].Username)
		require.NoError(t, err)
		return 1
	}

	rmC := func() keybase1.Seqno {
		err := RemoveMember(m[A].Ctx(), tcs[A].G, teamName.String(), fus[C].Username)
		require.NoError(t, err)
		return 1
	}

	rmD := func() keybase1.Seqno {
		err := RemoveMember(m[A].Ctx(), tcs[A].G, teamName.String(), fus[D].Username)
		require.NoError(t, err)
		return 1
	}

	setFastAudits := func() {
		// do a lot of probes so we're likely to find issues
		m[A].G().Env.Test.TeamAuditParams = &libkb.TeamAuditParams{
			NumPostProbes:         10,
			MerkleMovementTrigger: keybase1.Seqno(1),
			RootFreshness:         time.Duration(1),
			LRUSize:               500,
			NumPreProbes:          3,
			Parallelism:           3,
		}
	}

	assertAuditTo := func(n keybase1.Seqno) {
		auditor := m[A].G().GetTeamAuditor().(*Auditor)
		history, err := auditor.getFromCache(m[A], teamID, auditor.getLRU())
		require.NoError(t, err)
		require.Equal(t, n, lastAudit(history).MaxChainSeqno)
	}

	setFastAudits()
	actions := []func() keybase1.Seqno{addB, rmB, addC, rmC, addD, rmD}
	expectedSeqno := keybase1.Seqno(1)
	for _, action := range actions {
		expectedSeqno += action()
		load()
		assertAuditTo(expectedSeqno)
	}
}

type CorruptingMerkleClient struct {
	libkb.MerkleClientInterface

	corruptor func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error)
}

func (c CorruptingMerkleClient) LookupLeafAtSeqnoForAudit(m libkb.MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno, processHiddenResponseFunc libkb.ProcessHiddenRespFunc) (leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) {
	return c.corruptor(c.MerkleClientInterface.LookupLeafAtSeqnoForAudit(m, leafID, s, processHiddenResponseFunc))
}

var _ libkb.MerkleClientInterface = CorruptingMerkleClient{}

type MockRandom struct {
	libkb.SecureRandom
	nextOutputs []int64
	t           *testing.T
}

func (m *MockRandom) RndRange(lo, hi int64) (int64, error) {
	// pop and return the first output which is appropriate
	for i, n := range m.nextOutputs {
		if lo <= n && n <= hi {
			m.nextOutputs = append(m.nextOutputs[0:i], m.nextOutputs[i+1:]...)
			m.t.Logf("MockRandom: Output %v in range %v,%v (have %v left)", n, lo, hi, m.nextOutputs)
			return n, nil
		}
	}
	return 0, fmt.Errorf("MockRandom: output not found in range %v,%v (have %v left)", lo, hi, m.nextOutputs)
}

var _ libkb.Random = (*MockRandom)(nil)

func TestAuditFailsIfDataIsInconsistent(t *testing.T) {
	t.Skip("Doesn't work if TestFailedProbesAreRetried runs too close in time.")
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	m := make([]libkb.MetaContext, 3)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}

	// We set up codenames for 3 users, A, B, C
	const (
		A = 0
		B = 1
		C = 2
	)

	add := func(adder, addee int) keybase1.Seqno {
		_, err := AddMember(m[adder].Ctx(), tcs[adder].G, teamName.String(), fus[addee].Username, keybase1.TeamRole_READER, nil)
		require.NoError(t, err)
		return 1
	}

	setAudits := func(user int) {
		m[user].G().Env.Test.TeamAuditParams = &libkb.TeamAuditParams{
			NumPostProbes:         3,
			MerkleMovementTrigger: keybase1.Seqno(1),
			RootFreshness:         time.Duration(1),
			LRUSize:               500,
			NumPreProbes:          3,
			Parallelism:           3,
		}
	}

	assertAuditTo := func(user int, mainSeqno, hiddenSeqno keybase1.Seqno) {
		auditor := m[user].G().GetTeamAuditor().(*Auditor)
		history, err := auditor.getFromCache(m[user], teamID, auditor.getLRU())
		require.NoError(t, err)
		require.Equal(t, mainSeqno, lastAudit(history).MaxChainSeqno)
		require.Equal(t, hiddenSeqno, lastAudit(history).MaxHiddenSeqno)
	}

	setAudits(B)

	// A adds B to the team
	add(A, B)

	makeHiddenRotation(t, m[A].G(), teamName)
	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[A])
	makeHiddenRotation(t, m[A].G(), teamName)
	requestNewBlindTreeFromArchitectAndWaitUntilDone(t, tcs[A])
	add(A, C)

	team, err := GetForTestByStringName(context.TODO(), m[A].G(), teamName.String())
	require.NoError(t, err)

	headMerkleSeqno := int64(team.MainChain().Chain.HeadMerkle.Seqno)
	t.Logf("headMerkleSeqno: %v", headMerkleSeqno)

	firstWithHiddenS, err := m[A].G().GetMerkleClient().FirstMainRootWithHiddenRootHash(m[A])
	require.NoError(t, err)
	firstWithHidden := int64(firstWithHiddenS)
	t.Logf("firstWithHidden: %v", firstWithHidden)
	root := m[A].G().GetMerkleClient().LastRoot(m[A])
	require.NotNil(t, root)
	high := int64(*root.Seqno())
	t.Logf("latest root: %v %X", root.Seqno(), root.HashMeta())

	for i := headMerkleSeqno; i <= high; i++ {
		leaf, _, hiddenResp, err := m[B].G().GetMerkleClient().LookupLeafAtSeqnoForAudit(m[B], teamID.AsUserOrTeam(), keybase1.Seqno(i), hidden.ProcessHiddenResponseFunc)
		require.NoError(t, err)
		if leaf != nil && leaf.Private != nil && len(leaf.Private.LinkID) > 0 {
			t.Logf("Seqno %v Leaf %v Hidden %v", i, leaf.Private.Seqno, hiddenResp)
		} else {
			t.Logf("Seqno %v Leaf EMPTY Hidden %v", i, hiddenResp)
		}

	}

	merkle := m[B].G().GetMerkleClient()
	rand := m[B].G().GetRandom()

	corruptMerkle := CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			if leaf != nil && leaf.Private != nil && len(leaf.Private.LinkID) > 0 {
				leaf.Private.LinkID[0] ^= 0xff
				t.Logf("Corruptor: altering LINKID for %v", leaf.Private.Seqno)
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{firstWithHidden - 1, firstWithHidden, firstWithHidden + 1, headMerkleSeqno, headMerkleSeqno + 1, high - 1}})

	auditor := m[B].G().GetTeamAuditor().(*Auditor)
	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Contains(t, err.Error(), "team chain linkID mismatch")

	// repeat a second time to ensure that a failed audit is not cached (and thus skipped the second time)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{firstWithHidden - 1, firstWithHidden, firstWithHidden + 1, headMerkleSeqno, headMerkleSeqno + 1, high - 1}})
	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Contains(t, err.Error(), "team chain linkID mismatch")

	corruptMerkle = CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			if leaf != nil && leaf.Private != nil && len(leaf.Private.LinkID) > 0 {
				leaf.Private.Seqno += 5
				t.Logf("Corruptor: altering Seqno, leaf = %+v", leaf)
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{firstWithHidden - 1, firstWithHidden, firstWithHidden + 1, headMerkleSeqno, headMerkleSeqno + 1, high - 1}})

	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Contains(t, err.Error(), "team chain rollback")

	// now, let's try to mess with the preProbes, by making it appear as if the team existed before it was actually created.
	corruptMerkle = CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			if leaf == nil {
				leaf = &libkb.MerkleGenericLeaf{
					LeafID: teamID.AsUserOrTeam(),
				}
			}
			if leaf.Private == nil {
				t.Logf("Corruptor: creating a fake leaf when there should have been none")
				leaf.Private = &libkb.MerkleTriple{
					Seqno:  4,
					LinkID: []byte{0x00, 0x01, 0x02},
				}
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{firstWithHidden - 1, firstWithHidden, firstWithHidden + 1, headMerkleSeqno, headMerkleSeqno + 1, high - 1}})

	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Contains(t, err.Error(), "merkle root should not have had a leaf for team")

	// now, test that the server cannot cheat on the hidden chain.
	team, err = GetForTestByStringName(context.TODO(), m[A].G(), teamName.String())
	require.NoError(t, err)
	root = m[A].G().GetMerkleClient().LastRoot(m[A])
	require.NotNil(t, root)

	corruptMerkle = CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			if hiddenResp.RespType == libkb.MerkleHiddenResponseTypeABSENCEPROOF {
				t.Logf("Corruptor: creating a fake hidden leaf leaf when there should have been none")
				hiddenResp.RespType = libkb.MerkleHiddenResponseTypeOK
				hiddenResp.CommittedHiddenTail = &sig3.Tail{
					ChainType: keybase1.SeqType_TEAM_PRIVATE_HIDDEN,
					Seqno:     5,
				}
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{firstWithHidden - 1, firstWithHidden, firstWithHidden + 1, headMerkleSeqno, headMerkleSeqno + 1, high - 1}})

	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Contains(t, err.Error(), "expected an ABSENCE PROOF")

	corruptMerkle = CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			if hiddenResp.RespType == libkb.MerkleHiddenResponseTypeOK {
				t.Logf("Corruptor: altering hidden seqno")
				hiddenResp.CommittedHiddenTail.Seqno += 5
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{firstWithHidden - 1, firstWithHidden, firstWithHidden + 1, headMerkleSeqno, headMerkleSeqno + 1, high - 1}})

	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Contains(t, err.Error(), "team hidden chain rollback")

	corruptMerkle = CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			if hiddenResp.RespType == libkb.MerkleHiddenResponseTypeOK {
				hiddenResp.CommittedHiddenTail.Hash[0] ^= 0xff
				t.Logf("Corruptor: altering LINKID for hidden seqno %v", hiddenResp.CommittedHiddenTail.Seqno)
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{firstWithHidden - 1, firstWithHidden, firstWithHidden + 1, headMerkleSeqno, headMerkleSeqno + 1, high - 1}})

	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Contains(t, err.Error(), "hidden team chain linkID mismatch")

	// with the original merkle client (i.e. when the server response is not altered), the audit should succeed
	m[B].G().SetMerkleClient(merkle)
	m[B].G().SetRandom(rand)
	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.NoError(t, err)
	assertAuditTo(B, 3, 2)
}

func TestFailedProbesAreRetried(t *testing.T) {
	t.Skip("Doesn't work if TestAuditFailsIfDataIsInconsistent runs too close in time.")
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	// We set up codenames for 2 users, A, B
	const (
		A = 0
		B = 1
	)

	makePaperKey(t, tcs[A])
	makePaperKey(t, tcs[B])

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[A])
	m := make([]libkb.MetaContext, 3)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}

	add := func(adder, addee int) keybase1.Seqno {
		_, err := AddMember(m[adder].Ctx(), tcs[adder].G, teamName.String(), fus[addee].Username, keybase1.TeamRole_READER, nil)
		require.NoError(t, err)
		return 1
	}

	setFastAudits := func(user int) {
		m[user].G().Env.Test.TeamAuditParams = &libkb.TeamAuditParams{
			NumPostProbes:         2,
			MerkleMovementTrigger: keybase1.Seqno(1),
			RootFreshness:         time.Duration(1),
			LRUSize:               500,
			NumPreProbes:          2,
			Parallelism:           3,
		}
	}

	setFastAudits(B)

	// A adds B to the team
	add(A, B)

	// make some extra merkle tree versions
	makePaperKey(t, tcs[A])
	makePaperKey(t, tcs[B])
	makePaperKey(t, tcs[A])
	makePaperKey(t, tcs[B])
	makePaperKey(t, tcs[A])
	makePaperKey(t, tcs[B])

	team, err := GetForTestByStringName(context.TODO(), m[A].G(), teamName.String())
	require.NoError(t, err)
	root := m[A].G().GetMerkleClient().LastRoot(m[A])
	require.NotNil(t, root)
	latestRootSeqno := *root.Seqno()
	t.Logf("latest root: %v %X", root.Seqno(), root.HashMeta())
	headMerkleSeqno := team.MainChain().Chain.HeadMerkle.Seqno
	t.Logf("headMerkleSeqno: %v", headMerkleSeqno)
	firstWithHiddenS, err := m[A].G().GetMerkleClient().FirstMainRootWithHiddenRootHash(m[A])
	require.NoError(t, err)
	firstWithHidden := firstWithHiddenS
	t.Logf("firstWithHidden: %v", firstWithHidden)

	for i := headMerkleSeqno; i <= latestRootSeqno; i++ {
		leaf, _, hiddenResp, err := m[B].G().GetMerkleClient().LookupLeafAtSeqnoForAudit(m[B], teamID.AsUserOrTeam(), i, hidden.ProcessHiddenResponseFunc)
		require.NoError(t, err)
		if leaf != nil && leaf.Private != nil && len(leaf.Private.LinkID) > 0 {
			t.Logf("Seqno %v Leaf %v Hidden %v", i, leaf.Private.Seqno, hiddenResp)
		} else {
			t.Logf("Seqno %v Leaf EMPTY Hidden %v", i, hiddenResp)
		}
	}

	auditor := m[B].G().GetTeamAuditor().(*Auditor)
	lru := auditor.getLRU()

	// no audits yet, history is nil.
	history, err := auditor.getFromCache(m[B], teamID, lru)
	require.NoError(t, err)
	require.Nil(t, history)

	merkle := m[B].G().GetMerkleClient()
	rand := m[B].G().GetRandom()

	// first we corrupt postProbes and test that those are retried
	corruptMerkle := CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			if *root.Seqno() > headMerkleSeqno {
				if leaf != nil && leaf.Private != nil && len(leaf.Private.LinkID) > 0 {
					leaf.Private.LinkID[0] ^= 0xff
					t.Logf("Corruptor: altering LINKID for %v", leaf.Private.Seqno)
				} else {
					t.Logf("Corruptor: introducing leaf at roor %v", *root.Seqno())
					leaf = &libkb.MerkleGenericLeaf{
						LeafID:  teamID.AsUserOrTeam(),
						Private: &libkb.MerkleTriple{Seqno: keybase1.Seqno(100)},
					}
				}
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	// the first two are for preprobes, the last for post probes
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{int64(firstWithHidden) - 1, int64(firstWithHidden + 1), int64(headMerkleSeqno) + 1, int64(headMerkleSeqno) + 2}})

	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)

	history, err = auditor.getFromCache(m[B], teamID, lru)
	require.NoError(t, err)
	require.Len(t, history.PreProbesToRetry, 0)
	require.Len(t, history.PostProbesToRetry, 2)
	require.Contains(t, history.PostProbesToRetry, headMerkleSeqno+1)
	require.Contains(t, history.PostProbesToRetry, headMerkleSeqno+2)

	var probesToTestLock sync.Mutex
	probesToTest := make(map[keybase1.Seqno]bool)
	probesToTestLock.Lock()
	probesToTest[headMerkleSeqno+1] = true
	probesToTest[headMerkleSeqno+2] = true
	numProbes := 2
	probesToTestLock.Unlock()

	corruptMerkle = CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			probeSeqno := *root.Seqno()
			if probeSeqno > headMerkleSeqno {
				if probesToTest[probeSeqno] {
					t.Logf("PostProbes: Seqno %v was retried", probeSeqno)
					probesToTestLock.Lock()
					probesToTest[probeSeqno] = false
					numProbes--
					probesToTestLock.Unlock()
				}
				if leaf != nil && leaf.Private != nil && len(leaf.Private.LinkID) > 0 {
					leaf.Private.LinkID[0] ^= 0xff
					t.Logf("Corruptor: altering LINKID for %v", leaf.Private.Seqno)
				} else {
					t.Logf("Corruptor: introducing leaf at roor %v", *root.Seqno())
					leaf = &libkb.MerkleGenericLeaf{
						LeafID:  teamID.AsUserOrTeam(),
						Private: &libkb.MerkleTriple{Seqno: keybase1.Seqno(100)},
					}
				}
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	// note that the postProbes we will sample now are different from the ones which we failed on the first time, so we can test we are actually retrying those.
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{int64(firstWithHidden) - 1, int64(firstWithHidden + 1), int64(headMerkleSeqno) + 3, int64(headMerkleSeqno) + 4}})

	// repeat a second time and make sure that we retry the same probes
	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Zero(t, numProbes, "not all probes were retried")

	// now test the preprobes are saved and retried on failure
	corruptMerkle = CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			if leaf == nil {
				leaf = &libkb.MerkleGenericLeaf{
					LeafID: teamID.AsUserOrTeam(),
				}
			}
			if leaf.Private == nil {
				t.Logf("Corruptor: creating a fake leaf when there should have been none")
				leaf.Private = &libkb.MerkleTriple{
					Seqno:  4,
					LinkID: []byte{0x00, 0x01, 0x02},
				}
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{int64(firstWithHidden) - 1, int64(firstWithHidden + 1), int64(headMerkleSeqno) + 3, int64(headMerkleSeqno) + 4}})

	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Contains(t, err.Error(), "merkle root should not have had a leaf for team")

	history, err = auditor.getFromCache(m[B], teamID, lru)
	require.NoError(t, err)
	require.Len(t, history.PreProbesToRetry, 2)
	require.Contains(t, history.PreProbesToRetry, firstWithHidden-1)
	require.Contains(t, history.PreProbesToRetry, firstWithHidden+1)

	// the old failed postprobes are still in the cache
	require.Len(t, history.PostProbesToRetry, 2)
	require.Contains(t, history.PostProbesToRetry, headMerkleSeqno+1)
	require.Contains(t, history.PostProbesToRetry, headMerkleSeqno+2)

	probesToTest = make(map[keybase1.Seqno]bool)
	probesToTestLock.Lock()
	probesToTest[firstWithHidden-1] = true
	probesToTest[firstWithHidden+1] = true
	probesToTestLock.Unlock()
	numProbes = 2

	corruptMerkle = CorruptingMerkleClient{
		MerkleClientInterface: merkle,
		corruptor: func(leaf *libkb.MerkleGenericLeaf, root *libkb.MerkleRoot, hiddenResp *libkb.MerkleHiddenResponse, err error) (*libkb.MerkleGenericLeaf, *libkb.MerkleRoot, *libkb.MerkleHiddenResponse, error) {
			t.Logf("Corruptor: received %v,%v,%v,%v", leaf, root, hiddenResp, err)
			probeSeqno := *root.Seqno()
			if probeSeqno <= headMerkleSeqno {
				if probesToTest[probeSeqno] {
					t.Logf("PreProbes: Seqno %v was retried", probeSeqno)
					probesToTestLock.Lock()
					probesToTest[probeSeqno] = false
					numProbes--
					probesToTestLock.Unlock()
				}
				if leaf == nil {
					leaf = &libkb.MerkleGenericLeaf{
						LeafID: teamID.AsUserOrTeam(),
					}
				}
				if leaf.Private == nil {
					t.Logf("Corruptor: creating a fake leaf when there should have been none")
					leaf.Private = &libkb.MerkleTriple{
						Seqno:  4,
						LinkID: []byte{0x00, 0x01, 0x02},
					}
				}
			}
			return leaf, root, hiddenResp, err
		},
	}
	m[B].G().SetMerkleClient(corruptMerkle)
	m[B].G().SetRandom(&MockRandom{t: t, nextOutputs: []int64{int64(firstWithHidden) - 2, int64(firstWithHidden) + 2, int64(headMerkleSeqno) + 3, int64(headMerkleSeqno) + 4}})

	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.Error(t, err)
	require.IsType(t, AuditError{}, err)
	require.Zero(t, numProbes, "not all probes were retried")

	history, err = auditor.getFromCache(m[B], teamID, lru)
	require.NoError(t, err)
	require.Len(t, history.PreProbesToRetry, 2)
	require.Contains(t, history.PreProbesToRetry, firstWithHidden-1)
	require.Contains(t, history.PreProbesToRetry, firstWithHidden+1)

	// the old failed postprobes are still in the cache
	require.Len(t, history.PostProbesToRetry, 2)
	require.Contains(t, history.PostProbesToRetry, headMerkleSeqno+1)
	require.Contains(t, history.PostProbesToRetry, headMerkleSeqno+2)

	// now stop any corruption and ensure the audit succeeds
	m[B].G().SetMerkleClient(merkle)
	m[B].G().SetRandom(rand)
	err = auditor.AuditTeam(m[B], teamID, false, team.MainChain().Chain.HeadMerkle.Seqno, team.MainChain().Chain.LinkIDs, team.HiddenChain().GetOuter(), team.MainChain().Chain.LastSeqno, team.HiddenChain().GetLastCommittedSeqno(), root, keybase1.AuditMode_STANDARD)
	require.NoError(t, err)
}
