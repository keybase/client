package systests

import (
	"fmt"
	"math/rand"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func mustAppend(t *testing.T, a keybase1.TeamName, b string) keybase1.TeamName {
	ret, err := a.Append(b)
	require.NoError(t, err)
	return ret
}

func mustCreateSubteam(t *testing.T, tc *libkb.TestContext,
	name keybase1.TeamName) keybase1.TeamID {
	parent, err := name.Parent()
	require.NoError(t, err)
	id, err := teams.CreateSubteam(context.TODO(), tc.G, name.LastPart().String(),
		parent, keybase1.TeamRole_NONE)
	require.NoError(t, err)
	return *id
}

func loadTeamTree(t *testing.T, tmctx libkb.MetaContext, notifications *teamNotifyHandler,
	teamID keybase1.TeamID, username string, failureTeamIDs []keybase1.TeamID,
	teamFailures []string) ([]keybase1.TeamTreeMembership, error) {
	var err error

	guid := rand.Int()

	l, err := teams.NewTreeloader(tmctx, username, teamID, guid, true /* includeAncestors */)
	if err != nil {
		return nil, err
	}
	if failureTeamIDs != nil {
		l.Converter = newMockConverter(failureTeamIDs, l)
	}
	err = l.LoadAsync(tmctx)
	if err != nil {
		return nil, err
	}

	var results []keybase1.TeamTreeMembership
	var expectedCount *int
	got := 0
loop:
	for {
		select {
		case res := <-notifications.teamTreeMembershipsDoneCh:
			// We don't immediately break in this case because we are not guaranteed to receive this
			// notification last by the RPC layer. So we wait until all of the messages are
			// received. Even if there were errors, we should still get exactly this many
			// notifications in teamTreeMembershipsPartialCh.
			expectedCount = &res.ExpectedCount
			require.Equal(t, guid, res.Guid)
		case res := <-notifications.teamTreeMembershipsPartialCh:
			got++
			results = append(results, res)
			s, err := res.Result.S()
			require.NoError(t, err, "should never happen")
			switch s {
			case keybase1.TeamTreeMembershipStatus_OK:
			case keybase1.TeamTreeMembershipStatus_ERROR:
				require.Contains(t, teamFailures, res.TeamName,
					"unexpectedly got an error while loading team: %s", res.Result.Error().Message)
			}
			require.Equal(t, guid, res.Guid)
		case <-time.After(10 * time.Second):
			t.Fatalf("timed out waiting for team tree notifications")
		}
		if expectedCount != nil && *expectedCount == got {
			break loop
		}
	}
	return results, nil
}

func checkTeamTreeResults(t *testing.T, expected map[string]keybase1.TeamRole,
	failureTeamNames []string, hiddenTeamNames []string, results []keybase1.TeamTreeMembership) {
	require.Equal(t, len(expected)+len(failureTeamNames)+len(hiddenTeamNames),
		len(results), "got right number of results back")
	m := make(map[string]struct{})
	for _, result := range results {
		_, alreadyExists := m[result.TeamName]
		require.False(t, alreadyExists, "got a duplicate got %s", result.TeamName)
		m[result.TeamName] = struct{}{}
		s, err := result.Result.S()
		require.NoError(t, err)

		switch s {
		case keybase1.TeamTreeMembershipStatus_OK:
			r, ok := expected[result.TeamName]
			require.True(t, ok, "should not have gotten a result for %s", result.TeamName)
			val := result.Result.Ok()
			require.Equal(t, r, val.Role, "expected role %v for team %s, but got role %v",
				r, result.TeamName, val.Role)
			if val.Role != keybase1.TeamRole_NONE {
				require.NotNil(t, val.JoinTime)
			}
		case keybase1.TeamTreeMembershipStatus_ERROR:
			require.Contains(t, failureTeamNames, result.TeamName)
		case keybase1.TeamTreeMembershipStatus_HIDDEN:
			require.Contains(t, hiddenTeamNames, result.TeamName)
		default:
			t.Errorf("got an unknown result status %s", s)
		}
	}
}

type mockConverter struct {
	failureTeamIDs []keybase1.TeamID
	loader         *teams.Treeloader
}

func (m mockConverter) ProcessSigchainState(mctx libkb.MetaContext,
	teamName keybase1.TeamName, s *keybase1.TeamSigChainState) keybase1.TeamTreeMembershipResult {
	for _, failureTeamID := range m.failureTeamIDs {
		if failureTeamID == s.Id {
			return m.loader.NewErrorResult(fmt.Errorf("mock failure"), teamName)
		}
	}
	return m.loader.ProcessSigchainState(mctx, teamName, s)
}

func newMockConverter(failureTeamIDs []keybase1.TeamID, loader *teams.Treeloader) mockConverter {
	return mockConverter{
		failureTeamIDs: failureTeamIDs,
		loader:         loader,
	}
}

func TestLoadTeamTreeMemberships(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	t.Logf("Creating users")
	// Create the folowing team tree:
	//
	//     .___A_____.
	//     |         |
	//     B     .___C__.
	//           |      |
	//           D   .__E__.
	//           |   |  |  |
	//           F   G  H  I
	//
	// Teams are going to have the following members:
	//
	// A: zulu (adm)
	// B: yank (adm)
	// C: yank (adm), vict, tang
	// D: xray (adm), unif
	// E: tang (adm), vict
	// F: yank (adm)
	// G: yank, whis (adm), vict
	// H: zulu, xray
	// I: zulu, unif
	// Below, we generate paperkeys to set up a environment for testing the GUI integration.
	alfa := tt.addUserWithPaper("alfa")
	t.Logf("Generated paperkey for %s: %s", alfa.username, alfa.backupKey.secret)
	zulu := tt.addUserWithPaper("zulu")
	t.Logf("Generated paperkey for %s: %s", zulu.username, zulu.backupKey.secret)
	yank := tt.addUserWithPaper("yank")
	t.Logf("Generated paperkey for %s: %s", yank.username, yank.backupKey.secret)
	xray := tt.addUserWithPaper("xray")
	t.Logf("Generated paperkey for %s: %s", xray.username, xray.backupKey.secret)
	whis := tt.addUserWithPaper("whis")
	t.Logf("Generated paperkey for %s: %s", whis.username, whis.backupKey.secret)
	vict := tt.addUserWithPaper("vict")
	t.Logf("Generated paperkey for %s: %s", vict.username, vict.backupKey.secret)
	unif := tt.addUserWithPaper("unif")
	t.Logf("UGenerated paperkey for %s: %s", unif.username, unif.backupKey.secret)
	tang := tt.addUserWithPaper("tang")
	t.Logf("Generated paperkey for %s: %s", tang.username, tang.backupKey.secret)

	t.Logf("Creating teams")
	aID, aName := alfa.createTeam2()
	bName := mustAppend(t, aName, "bb")
	cName := mustAppend(t, aName, "cc")
	dName := mustAppend(t, cName, "dd")
	eName := mustAppend(t, cName, "ee")
	fName := mustAppend(t, dName, "ff")
	gName := mustAppend(t, eName, "gg")
	hName := mustAppend(t, eName, "hh")
	iName := mustAppend(t, eName, "ii")
	bID := mustCreateSubteam(t, alfa.tc, bName)
	cID := mustCreateSubteam(t, alfa.tc, cName)
	dID := mustCreateSubteam(t, alfa.tc, dName)
	eID := mustCreateSubteam(t, alfa.tc, eName)
	fID := mustCreateSubteam(t, alfa.tc, fName)
	gID := mustCreateSubteam(t, alfa.tc, gName)
	hID := mustCreateSubteam(t, alfa.tc, hName)
	iID := mustCreateSubteam(t, alfa.tc, iName)

	var err error

	t.Logf("Populating teams with members")
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, aID,
		[]keybase1.UserRolePair{
			{Assertion: zulu.username, Role: keybase1.TeamRole_ADMIN},
		},
		nil,
	)
	require.NoError(t, err)
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, bID,
		[]keybase1.UserRolePair{
			{Assertion: yank.username, Role: keybase1.TeamRole_ADMIN},
		},
		nil,
	)
	require.NoError(t, err)
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, cID,
		[]keybase1.UserRolePair{
			{Assertion: yank.username, Role: keybase1.TeamRole_ADMIN},
			{Assertion: vict.username, Role: keybase1.TeamRole_WRITER},
			{Assertion: tang.username, Role: keybase1.TeamRole_WRITER},
		},
		nil,
	)
	require.NoError(t, err)
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, dID,
		[]keybase1.UserRolePair{
			{Assertion: xray.username, Role: keybase1.TeamRole_ADMIN},
			{Assertion: unif.username, Role: keybase1.TeamRole_WRITER},
		},
		nil,
	)
	require.NoError(t, err)
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, eID,
		[]keybase1.UserRolePair{
			{Assertion: tang.username, Role: keybase1.TeamRole_ADMIN},
			{Assertion: vict.username, Role: keybase1.TeamRole_WRITER},
		},
		nil,
	)
	require.NoError(t, err)
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, fID,
		[]keybase1.UserRolePair{
			{Assertion: yank.username, Role: keybase1.TeamRole_ADMIN},
		},
		nil,
	)
	require.NoError(t, err)
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, gID,
		[]keybase1.UserRolePair{
			{Assertion: yank.username, Role: keybase1.TeamRole_WRITER},
			{Assertion: whis.username, Role: keybase1.TeamRole_ADMIN},
			{Assertion: vict.username, Role: keybase1.TeamRole_WRITER},
		},
		nil,
	)
	require.NoError(t, err)
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, hID,
		[]keybase1.UserRolePair{
			{Assertion: zulu.username, Role: keybase1.TeamRole_WRITER},
			{Assertion: xray.username, Role: keybase1.TeamRole_WRITER},
		},
		nil,
	)
	require.NoError(t, err)
	_, _, err = teams.AddMembers(context.Background(), alfa.tc.G, iID,
		[]keybase1.UserRolePair{
			{Assertion: zulu.username, Role: keybase1.TeamRole_WRITER},
			{Assertion: unif.username, Role: keybase1.TeamRole_WRITER},
		},
		nil,
	)
	require.NoError(t, err)

	t.Logf("Modifying teams")
	tui := &teamsUI{}
	err = teams.Delete(context.Background(), alfa.tc.G, tui, hID)
	require.NoError(t, err)
	tang.reset()
	tang.loginAfterReset()
	unif.delete()

	t.Logf("happy-path table tests")
	tsts := []struct {
		teamID    keybase1.TeamID
		requester *userPlusDevice
		target    *userPlusDevice
		hidden    []string
		expected  map[string]keybase1.TeamRole
	}{
		{
			teamID:    aID,
			requester: zulu,
			target:    zulu,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_ADMIN,
				bName.String(): keybase1.TeamRole_NONE,
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_NONE,
				iName.String(): keybase1.TeamRole_WRITER,
			},
			hidden: []string{},
		},
		{
			teamID:    bID,
			requester: zulu,
			target:    zulu,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_ADMIN,
				bName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{},
		},
		{
			teamID:    bID,
			requester: zulu,
			target:    yank,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_NONE,
				bName.String(): keybase1.TeamRole_ADMIN,
			},
		},
		{
			teamID:    bID,
			requester: yank,
			target:    zulu,
			expected: map[string]keybase1.TeamRole{
				bName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    bID,
			requester: yank,
			target:    yank,
			expected: map[string]keybase1.TeamRole{
				bName.String(): keybase1.TeamRole_ADMIN,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    cID,
			requester: zulu,
			target:    yank,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_NONE,
				cName.String(): keybase1.TeamRole_ADMIN,
				dName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_ADMIN,
				gName.String(): keybase1.TeamRole_WRITER,
				iName.String(): keybase1.TeamRole_NONE,
			},
		},
		{
			teamID:    cID,
			requester: yank,
			target:    yank,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_ADMIN,
				dName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_ADMIN,
				gName.String(): keybase1.TeamRole_WRITER,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    cID,
			requester: zulu,
			target:    whis,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_NONE,
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_ADMIN,
				iName.String(): keybase1.TeamRole_NONE,
			},
		},
		{
			teamID:    cID,
			requester: yank,
			target:    whis,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_ADMIN,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},

		{
			teamID:    cID,
			requester: zulu,
			target:    xray,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_NONE,
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_ADMIN,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_NONE,
				iName.String(): keybase1.TeamRole_NONE,
			},
		},
		{
			teamID:    cID,
			requester: yank,
			target:    xray,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_ADMIN,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_NONE,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    cID,
			requester: yank,
			target:    tang, // in no teams after reset
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_NONE,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    dID,
			requester: zulu,
			target:    zulu,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_ADMIN,
				dName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{cName.String()},
		},
		{
			teamID:    dID,
			requester: yank,
			target:    zulu,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    dID,
			requester: xray,
			target:    zulu,
			expected: map[string]keybase1.TeamRole{
				dName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String(), cName.String()},
		},
		{
			teamID:    dID,
			requester: zulu,
			target:    vict,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{cName.String()},
		},
		{
			teamID:    dID,
			requester: yank,
			target:    vict,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_WRITER,
				dName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    dID,
			requester: xray,
			target:    vict,
			expected: map[string]keybase1.TeamRole{
				dName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String(), cName.String()},
		},
		{
			teamID:    dID,
			requester: zulu,
			target:    xray,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_ADMIN,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{cName.String()},
		},
		{
			teamID:    dID,
			requester: yank,
			target:    xray,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_ADMIN,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    dID,
			requester: xray,
			target:    xray,
			expected: map[string]keybase1.TeamRole{
				dName.String(): keybase1.TeamRole_ADMIN,
				fName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String(), cName.String()},
		},
		{
			teamID:    eID,
			requester: yank,
			target:    vict,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_WRITER,
				eName.String(): keybase1.TeamRole_WRITER,
				gName.String(): keybase1.TeamRole_WRITER,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    eID,
			requester: yank,
			target:    xray,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_NONE,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:    gID,
			requester: whis,
			target:    whis,
			expected: map[string]keybase1.TeamRole{
				gName.String(): keybase1.TeamRole_ADMIN,
			},
			hidden: []string{aName.String(), cName.String(), eName.String()},
		},
		{
			teamID:    gID,
			requester: yank,
			target:    whis,
			expected: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_ADMIN,
			},
			hidden: []string{aName.String(), eName.String()},
		},
		{
			teamID:    gID,
			requester: zulu,
			target:    whis,
			expected: map[string]keybase1.TeamRole{
				aName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_ADMIN,
			},
			hidden: []string{cName.String(), eName.String()},
		},
	}
	for idx, tst := range tsts {
		t.Logf("Testing testcase %d", idx)
		name := fmt.Sprintf("happy/%d", idx)
		t.Run(name, func(t *testing.T) {
			mctx := libkb.NewMetaContextForTest(*tst.requester.tc)
			results, err := loadTeamTree(t, mctx, tst.requester.notifications,
				tst.teamID, tst.target.username, nil, nil)
			require.NoError(t, err)
			checkTeamTreeResults(t, tst.expected, nil, tst.hidden, results)
		})
	}

	t.Logf("error path table testing")
	errorTsts := []struct {
		teamID            keybase1.TeamID
		requester         *userPlusDevice
		target            *userPlusDevice
		failureTeamIDs    []keybase1.TeamID
		failureTeamNames  []string
		hidden            []string
		expectedSuccesses map[string]keybase1.TeamRole
	}{
		{
			teamID:           cID,
			requester:        yank,
			target:           whis,
			failureTeamIDs:   []keybase1.TeamID{dID, gID},
			failureTeamNames: []string{dName.String(), gName.String()},
			expectedSuccesses: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:           cID,
			requester:        yank,
			target:           whis,
			failureTeamIDs:   []keybase1.TeamID{iID},
			failureTeamNames: []string{iName.String()},
			expectedSuccesses: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				dName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				fName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_ADMIN,
			},
			hidden: []string{aName.String()},
		},
		{
			teamID:           eID,
			requester:        yank,
			target:           whis,
			failureTeamIDs:   []keybase1.TeamID{cID},
			failureTeamNames: []string{cName.String()},
			expectedSuccesses: map[string]keybase1.TeamRole{
				eName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_ADMIN,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{},
		},
		{
			teamID:           eID,
			requester:        yank,
			target:           whis,
			failureTeamIDs:   []keybase1.TeamID{aID},
			failureTeamNames: []string{aName.String()},
			expectedSuccesses: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_ADMIN,
				iName.String(): keybase1.TeamRole_NONE,
			},
			hidden: []string{},
		},
		{
			teamID:           eID,
			requester:        yank,
			target:           whis,
			failureTeamIDs:   []keybase1.TeamID{aID, iID},
			failureTeamNames: []string{aName.String(), iName.String()},
			expectedSuccesses: map[string]keybase1.TeamRole{
				cName.String(): keybase1.TeamRole_NONE,
				eName.String(): keybase1.TeamRole_NONE,
				gName.String(): keybase1.TeamRole_ADMIN,
			},
			hidden: []string{},
		},
		{
			teamID:            eID,
			requester:         yank,
			target:            whis,
			failureTeamIDs:    []keybase1.TeamID{eID},
			failureTeamNames:  []string{eName.String()},
			expectedSuccesses: map[string]keybase1.TeamRole{},
			hidden:            []string{},
		},
	}
	for idx, tst := range errorTsts {
		t.Logf("Testing testcase %d", idx)
		name := fmt.Sprintf("error/%d", idx)
		t.Run(name, func(t *testing.T) {
			mctx := libkb.NewMetaContextForTest(*tst.requester.tc)
			results, err := loadTeamTree(t, mctx, tst.requester.notifications, tst.teamID,
				tst.target.username, tst.failureTeamIDs, tst.failureTeamNames)
			require.NoError(t, err)
			checkTeamTreeResults(t, tst.expectedSuccesses, tst.failureTeamNames,
				tst.hidden, results)
		})
	}

	t.Logf("miscellaneous tests")
	zuluMctx := libkb.NewMetaContextForTest(*zulu.tc)
	victMctx := libkb.NewMetaContextForTest(*vict.tc)

	_, err = loadTeamTree(t, zuluMctx, zulu.notifications, cID, unif.username, nil, nil)
	require.IsType(t, libkb.NoKeyError{}, err, "cannot load a deleted user")

	_, err = loadTeamTree(t, victMctx, vict.notifications, cID, yank.username, nil, nil)
	require.IsType(t, teams.StubbedError{}, err, "can only load if you're an admin")
}
