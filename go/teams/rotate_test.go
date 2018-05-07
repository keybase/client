package teams

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestRotate(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if team.Generation() != 1 {
		t.Fatalf("initial team generation: %d, expected 1", team.Generation())
	}
	secretBefore := team.Data.PerTeamKeySeeds[team.Generation()].Seed.ToBytes()
	keys1, err := team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	if err != nil {
		t.Fatal(err)
	}
	require.Equal(t, len(keys1), 1)
	require.Equal(t, keys1[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))

	if err := team.Rotate(context.TODO()); err != nil {
		t.Fatal(err)
	}

	after, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if after.Generation() != 2 {
		t.Fatalf("rotated team generation: %d, expected 2", after.Generation())
	}
	secretAfter := after.Data.PerTeamKeySeeds[after.Generation()].Seed.ToBytes()
	if libkb.SecureByteArrayEq(secretAfter, secretBefore) {
		t.Fatal("TeamBox.Ctext did not change when rotated")
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	keys2, err := after.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, len(keys2), 2)
	require.Equal(t, keys2[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))
	require.Equal(t, keys1[0].Key, keys2[0].Key)
}

func setupRotateTest(t *testing.T, implicit bool, public bool) (tc libkb.TestContext, owner, other *kbtest.FakeUser, teamID keybase1.TeamID, teamName keybase1.TeamName) {
	tc = SetupTest(t, "team", 1)

	var usernames []string

	other, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	usernames = append(usernames, other.Username)
	tc.G.Logout()

	owner, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	usernames = append(usernames, owner.Username)

	if implicit {
		t.Logf("creating implicit team")
		displayName := strings.Join(usernames, ",")
		var team *Team
		team, teamName, _, err = LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.NoError(t, err)

		return tc, owner, other, team.ID, teamName
	}
	if public {
		t.Fatalf("public teams not supported")
	}

	t.Logf("creating team")
	teamName, teamID = createTeam2(tc)

	t.Logf("adding writer")
	err = SetRoleWriter(context.TODO(), tc.G, teamName.String(), other.Username)
	require.NoError(t, err)

	return tc, owner, other, teamID, teamName
}

func TestHandleRotateRequestOldGeneration(t *testing.T) {
	runMany(t, func(implicit, public bool) {
		tc, owner, other, teamID, _ := setupRotateTest(t, implicit, public)
		defer tc.Cleanup()

		team, err := GetForTestByID(context.TODO(), tc.G, teamID)
		require.NoError(t, err)

		// rotate to bump the generation
		err = team.Rotate(context.TODO())
		require.NoError(t, err)

		team, err = GetForTestByID(context.TODO(), tc.G, teamID)
		require.NoError(t, err)
		if team.Generation() != 2 {
			t.Fatalf("team generation: %d, expected 2", team.Generation())
		}
		secretBefore := team.Data.PerTeamKeySeeds[team.Generation()].Seed.ToBytes()

		// this shouldn't do anything
		err = HandleRotateRequest(context.TODO(), tc.G, keybase1.TeamCLKRMsg{
			TeamID:              team.ID,
			Generation:          1,
			ResetUsersUntrusted: nil,
		})
		require.NoError(t, err)

		after, err := GetForTestByID(context.TODO(), tc.G, teamID)
		require.NoError(t, err)
		if after.Generation() != 2 {
			t.Fatalf("HandleRotateRequest with old generation changed team generation: %d, expected 2", after.Generation())
		}
		secretAfter := after.Data.PerTeamKeySeeds[after.Generation()].Seed.ToBytes()
		require.True(t, libkb.SecureByteArrayEq(secretAfter, secretBefore), "team secret changed after HandleRotateRequest with old generation")

		if implicit {
			assertRole2(tc, teamID, owner.Username, keybase1.TeamRole_OWNER)
			assertRole2(tc, teamID, other.Username, keybase1.TeamRole_OWNER)
		} else {
			assertRole2(tc, teamID, owner.Username, keybase1.TeamRole_OWNER)
			assertRole2(tc, teamID, other.Username, keybase1.TeamRole_WRITER)
		}
	})
}

func TestHandleRotateRequest(t *testing.T) {
	runMany(t, func(implicit, public bool) {
		tc, owner, other, teamID, _ := setupRotateTest(t, implicit, public)
		defer tc.Cleanup()

		team, err := GetForTestByID(context.TODO(), tc.G, teamID)
		require.NoError(t, err)
		if team.Generation() != 1 {
			t.Fatalf("initial team generation: %d, expected 1", team.Generation())
		}
		secretBefore := team.Data.PerTeamKeySeeds[team.Generation()].Seed.ToBytes()

		err = HandleRotateRequest(context.TODO(), tc.G, keybase1.TeamCLKRMsg{
			TeamID:              team.ID,
			Generation:          team.Generation(),
			ResetUsersUntrusted: nil,
		})
		require.NoError(t, err)

		after, err := GetForTestByID(context.TODO(), tc.G, teamID)
		require.NoError(t, err)
		if after.Generation() != 2 {
			t.Fatalf("rotated team generation: %d, expected 2", after.Generation())
		}
		secretAfter := after.Data.PerTeamKeySeeds[after.Generation()].Seed.ToBytes()
		require.False(t, libkb.SecureByteArrayEq(secretAfter, secretBefore), "team secret should change when rotated")

		if implicit {
			assertRole2(tc, teamID, owner.Username, keybase1.TeamRole_OWNER)
			assertRole2(tc, teamID, other.Username, keybase1.TeamRole_OWNER)
		} else {
			assertRole2(tc, teamID, owner.Username, keybase1.TeamRole_OWNER)
			assertRole2(tc, teamID, other.Username, keybase1.TeamRole_WRITER)
		}
	})
}

func TestImplicitAdminAfterRotateRequest(t *testing.T) {
	tc, owner, otherA, otherB, root, sub := memberSetupSubteam(t)
	defer tc.Cleanup()

	team, err := GetForTestByStringName(context.TODO(), tc.G, sub)
	if err != nil {
		t.Fatal(err)
	}
	if team.Generation() != 1 {
		t.Fatalf("initial subteam generation: %d, expected 1", team.Generation())
	}
	secretBefore := team.Data.PerTeamKeySeeds[team.Generation()].Seed.ToBytes()

	params := keybase1.TeamCLKRMsg{
		TeamID:              team.ID,
		Generation:          team.Generation(),
		ResetUsersUntrusted: nil,
	}
	if err := HandleRotateRequest(context.TODO(), tc.G, params); err != nil {
		t.Fatal(err)
	}

	after, err := GetForTestByStringName(context.TODO(), tc.G, sub)
	if err != nil {
		t.Fatal(err)
	}

	if after.Generation() != 2 {
		t.Fatalf("rotated subteam generation: %d, expected 2", after.Generation())
	}
	secretAfter := after.Data.PerTeamKeySeeds[after.Generation()].Seed.ToBytes()
	if libkb.SecureByteArrayEq(secretAfter, secretBefore) {
		t.Fatal("team secret did not change when rotated")
	}

	// make sure the roles are ok after rotate
	assertRole(tc, root, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, root, otherA.Username, keybase1.TeamRole_ADMIN)
	assertRole(tc, root, otherB.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, otherA.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, otherB.Username, keybase1.TeamRole_NONE)

	// otherA (an implicit admin of sub) should be able to add otherB to sub
	// after the rotate

	// switch to `otherA` user
	tc.G.Logout()
	if err := otherA.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	// otherA has the power to add otherB to the subteam
	res, err := AddMember(context.TODO(), tc.G, sub, otherB.Username, keybase1.TeamRole_WRITER)
	if err != nil {
		t.Fatal(err)
	}
	if res.User.Username != otherB.Username {
		t.Errorf("AddMember result username %q does not match arg username %q", res.User.Username, otherB.Username)
	}
	// otherB should now be a writer
	assertRole(tc, sub, otherB.Username, keybase1.TeamRole_WRITER)

	// owner, otherA should still be non-members
	assertRole(tc, sub, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, otherA.Username, keybase1.TeamRole_NONE)
}

// Test multiple rotations racing to post chain links to the same team.
// The expected behavior is that they each either succeed or run out of attempts.
func TestRotateRace(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	t.Logf("U0 creates A")
	_, rootID := createTeam2(*tcs[0])

	rotate := func(userIndexOperator int) <-chan error {
		errCh := make(chan error)
		go func() {
			params := keybase1.TeamCLKRMsg{
				TeamID:              rootID,
				Generation:          keybase1.PerTeamKeyGeneration(100),
				ResetUsersUntrusted: nil,
			}
			err := HandleRotateRequest(context.TODO(), tcs[userIndexOperator].G, params)
			errCh <- err
		}()
		return errCh
	}

	assertNoErr := func(errCh <-chan error, msgAndArgs ...interface{}) {
		select {
		case err := <-errCh:
			require.NoError(t, err, msgAndArgs...)
		case <-time.After(20 * time.Second):
			require.FailNow(t, "timeout waiting for return channel")
		}
	}

	for i := 0; i < 5; i++ {
		t.Logf("round %v", i)

		errCh1 := rotate(0)
		errCh2 := rotate(0)
		assertNoErr(errCh1, "round %v", i)
		assertNoErr(errCh2, "round %v", i)
	}
}

func testRotateTeamSweeping(t *testing.T, open bool) {
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	otherC, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	tc.G.Logout()

	t.Logf("Created team %q", name)
	require.NoError(t, owner.Login(tc.G))

	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherA.Username))
	require.NoError(t, SetRoleAdmin(context.Background(), tc.G, name, otherB.Username))
	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherC.Username))

	if open {
		err = ChangeTeamSettings(context.Background(), tc.G, name, keybase1.TeamSettings{
			Open:   true,
			JoinAs: keybase1.TeamRole_READER,
		})
		require.NoError(t, err)
	}

	team, err := GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	allMembers, err := team.UsersWithRoleOrAbove(keybase1.TeamRole_READER)
	require.NoError(t, err)
	require.Len(t, allMembers, 4)

	// Rotate and reload team while members are not reset yet. Member
	// set should not change.
	err = HandleRotateRequest(context.Background(), tc.G, keybase1.TeamCLKRMsg{
		TeamID:              team.ID,
		Generation:          team.Generation(),
		ResetUsersUntrusted: nil,
	})
	require.NoError(t, err)
	team, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	members, err := team.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUIDs(), 4)

	// Reset otherA (writer) and otherB (admin). otherA should be
	// removed if the team is open.
	for _, u := range []*kbtest.FakeUser{otherA, otherB} {
		tc.G.Logout()
		require.NoError(t, u.Login(tc.G))

		kbtest.ResetAccount(tc, u)
	}

	tc.G.Logout()
	err = owner.Login(tc.G)
	require.NoError(t, err)

	// Rotate - should trigger sweeping path if the team is open.
	params := keybase1.TeamCLKRMsg{
		TeamID:     team.ID,
		Generation: team.Generation(),
	}
	if open {
		// If the team is not open, team_rekeyd will not tell us about
		// reset people.
		params.ResetUsersUntrusted = []keybase1.TeamCLKRResetUser{
			keybase1.TeamCLKRResetUser{
				Uid:               otherA.User.GetUID(),
				UserEldestSeqno:   keybase1.Seqno(0),
				MemberEldestSeqno: keybase1.Seqno(1),
			}}
	}
	err = HandleRotateRequest(context.Background(), tc.G, params)
	require.NoError(t, err)

	// Reload team and check results.
	team, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	members2, err := team.Members()
	require.NoError(t, err)
	if open {
		allUids := members2.AllUIDs()
		require.Len(t, allUids, 3)

		require.Contains(t, allUids, owner.User.GetUID())
		require.Contains(t, allUids, otherB.User.GetUID())
		require.Contains(t, allUids, otherC.User.GetUID())

		require.NotContains(t, allUids, otherA.User.GetUID())
	} else {
		require.ElementsMatch(t, members2.AllUserVersions(), members.AllUserVersions())
	}

	require.Equal(t, keybase1.PerTeamKeyGeneration(3), team.Generation())
}

func TestRotateTeamSweeping(t *testing.T) {
	// Tests that when a key rotation is requested, reset members are
	// removed from open team but not closed team.
	testRotateTeamSweeping(t, false /* open */)
	testRotateTeamSweeping(t, true /* open */)
}

func TestRotateWithBadUIDs(t *testing.T) {
	// Try the rotate key + remove reset members machinery, but
	// simulate server giving us one bad UID (for a person that has
	// not reset at all), and UID of an admin, who has reset. Neither
	// of the users should be removed from the team.

	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	t.Logf("Created team %q", name)

	err := ChangeTeamSettings(context.Background(), tc.G, name, keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherA.Username))
	require.NoError(t, SetRoleAdmin(context.Background(), tc.G, name, otherB.Username))

	// Logout and reset (admin member).
	tc.G.Logout()
	require.NoError(t, otherB.Login(tc.G))
	kbtest.ResetAccount(tc, otherB)

	// Re-login as owner, simulate CLKR message.
	tc.G.Logout()
	err = owner.Login(tc.G)
	require.NoError(t, err)

	team, err := GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	params := keybase1.TeamCLKRMsg{
		TeamID:     team.ID,
		Generation: team.Generation(),
	}
	for _, u := range []*kbtest.FakeUser{otherA, otherB} {
		// otherA has not reset at all, but assume it ended up in the
		// message. otherB has really reset, but is an admin.
		params.ResetUsersUntrusted = append(params.ResetUsersUntrusted,
			keybase1.TeamCLKRResetUser{
				Uid:               u.User.GetUID(),
				UserEldestSeqno:   keybase1.Seqno(0),
				MemberEldestSeqno: keybase1.Seqno(1),
			})
	}

	err = HandleRotateRequest(context.Background(), tc.G, params)
	require.NoError(t, err)

	// Check that no one has been removed, and team generation has
	// changed.
	team, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	members, err := team.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUserVersions(), 3)
	allUids := members.AllUIDs()
	require.Contains(t, allUids, owner.User.GetUID())
	require.Contains(t, allUids, otherA.User.GetUID())
	require.Contains(t, allUids, otherB.User.GetUID())

	require.Equal(t, keybase1.PerTeamKeyGeneration(2), team.Generation())
}

func TestRotateResetMultipleUsers(t *testing.T) {
	// Same reset test but with multiple users being removed at once.
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	otherC, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	tc.G.Logout()
	require.NoError(t, owner.Login(tc.G))

	err = ChangeTeamSettings(context.Background(), tc.G, name, keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherA.Username))
	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherB.Username))
	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherC.Username))

	team, err := GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	params := keybase1.TeamCLKRMsg{
		TeamID:     team.ID,
		Generation: team.Generation(),
	}

	for _, u := range []*kbtest.FakeUser{otherA, otherB, otherC} {
		tc.G.Logout()
		require.NoError(t, u.Login(tc.G))

		if u != otherC {
			kbtest.ResetAccount(tc, u)
		} else {
			kbtest.DeleteAccount(tc, u)
		}

		params.ResetUsersUntrusted = append(params.ResetUsersUntrusted,
			keybase1.TeamCLKRResetUser{
				Uid:               u.User.GetUID(),
				UserEldestSeqno:   keybase1.Seqno(0),
				MemberEldestSeqno: keybase1.Seqno(1),
			})
	}

	tc.G.Logout()
	err = owner.Login(tc.G)
	require.NoError(t, err)

	err = HandleRotateRequest(context.Background(), tc.G, params)
	require.NoError(t, err)

	// Check that everyone has been removed and team generation changed.
	team, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	members, err := team.Members()
	require.NoError(t, err)
	allUVs := members.AllUserVersions()
	require.Len(t, allUVs, 1)
	require.Contains(t, allUVs, keybase1.NewUserVersion(owner.User.GetUID(), owner.EldestSeqno))
}

func TestRemoveWithoutRotation(t *testing.T) {
	tc, _, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherA.Username))

	team, err := GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	req := keybase1.TeamChangeReq{
		Writers: []keybase1.UserVersion{
			keybase1.NewUserVersion(otherB.User.GetUID(), otherB.EldestSeqno),
		},
		None: []keybase1.UserVersion{
			keybase1.NewUserVersion(otherA.User.GetUID(), otherA.EldestSeqno),
		},
	}

	opts := ChangeMembershipOptions{
		SkipKeyRotation: true,
	}
	err = team.ChangeMembershipWithOptions(context.Background(), req, opts)
	require.NoError(t, err)

	require.EqualValues(t, 1, team.Generation())

	team, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)
	// Generation should still be one, ChangeMembership should not
	// have posted new key.
	require.EqualValues(t, 1, team.Generation())
}
