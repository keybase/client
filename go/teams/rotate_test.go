package teams

import (
	"context"
	"encoding/hex"
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
	secretBefore := team.Data.PerTeamKeySeedsUnverified[team.Generation()].Seed.ToBytes()
	keys1, err := team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	if err != nil {
		t.Fatal(err)
	}
	require.Equal(t, len(keys1), 1)
	require.Equal(t, keys1[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))

	if err := team.Rotate(context.TODO(), keybase1.RotationType_VISIBLE); err != nil {
		t.Fatal(err)
	}

	after, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if after.Generation() != 2 {
		t.Fatalf("rotated team generation: %d, expected 2", after.Generation())
	}
	secretAfter := after.Data.PerTeamKeySeedsUnverified[after.Generation()].Seed.ToBytes()
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

func TestRotateWithBots(t *testing.T) {
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	err := SetRoleBot(context.TODO(), tc.G, name, otherA.Username)
	require.NoError(t, err)

	err = SetRoleRestrictedBot(context.TODO(), tc.G, name, otherB.Username, keybase1.TeamBotSettings{})
	require.NoError(t, err)

	tc.G.Logout(context.TODO())
	require.NoError(t, otherA.Login(tc.G))
	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.EqualValues(t, 1, team.Generation())
	require.Len(t, team.Data.PerTeamKeySeedsUnverified, 1)
	_, err = team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)

	// Regular bots cannot rotate
	err = team.Rotate(context.TODO(), keybase1.RotationType_VISIBLE)
	require.Error(t, err)

	tc.G.Logout(context.TODO())
	require.NoError(t, otherB.Login(tc.G))
	team, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.EqualValues(t, 1, team.Generation())
	require.Zero(t, len(team.Data.PerTeamKeySeedsUnverified))
	_, err = team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)

	// Restricted bots cannot rotate
	err = team.Rotate(context.TODO(), keybase1.RotationType_VISIBLE)
	require.IsType(t, libkb.NotFoundError{}, err)

	tc.G.Logout(context.TODO())
	require.NoError(t, owner.Login(tc.G))
	team, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_VISIBLE)
	require.NoError(t, err)

	// otherA has 2 seeds
	tc.G.Logout(context.TODO())
	require.NoError(t, otherA.Login(tc.G))
	after, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.EqualValues(t, 2, after.Generation())
	require.Len(t, after.Data.PerTeamKeySeedsUnverified, 2)

	// otherB has none
	tc.G.Logout(context.TODO())
	require.NoError(t, otherB.Login(tc.G))
	after, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.EqualValues(t, 2, after.Generation())
	require.Zero(t, len(after.Data.PerTeamKeySeedsUnverified))
	_, err = after.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, otherA.Username, keybase1.TeamRole_BOT)
	assertRole(tc, name, otherB.Username, keybase1.TeamRole_RESTRICTEDBOT)
}

func setupRotateTest(t *testing.T, implicit bool, public bool) (tc libkb.TestContext, owner, other *kbtest.FakeUser, teamID keybase1.TeamID, teamName keybase1.TeamName) {
	tc = SetupTest(t, "team", 1)

	var usernames []string

	other, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	usernames = append(usernames, other.Username)
	tc.G.Logout(context.TODO())

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
		err = team.Rotate(context.TODO(), keybase1.RotationType_VISIBLE)
		require.NoError(t, err)

		team, err = GetForTestByID(context.TODO(), tc.G, teamID)
		require.NoError(t, err)
		if team.Generation() != 2 {
			t.Fatalf("team generation: %d, expected 2", team.Generation())
		}
		secretBefore := team.Data.PerTeamKeySeedsUnverified[team.Generation()].Seed.ToBytes()

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
		secretAfter := after.Data.PerTeamKeySeedsUnverified[after.Generation()].Seed.ToBytes()
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
		secretBefore := team.Data.PerTeamKeySeedsUnverified[team.Generation()].Seed.ToBytes()

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
		secretAfter := after.Data.PerTeamKeySeedsUnverified[after.Generation()].Seed.ToBytes()
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
	require.NoError(t, err)
	require.EqualValues(t, 1, team.Generation())
	secretBefore := team.Data.PerTeamKeySeedsUnverified[team.Generation()].Seed.ToBytes()

	params := keybase1.TeamCLKRMsg{
		TeamID:              team.ID,
		Generation:          team.Generation(),
		ResetUsersUntrusted: nil,
	}
	require.NoError(t, HandleRotateRequest(context.TODO(), tc.G, params))

	after, err := GetForTestByStringName(context.TODO(), tc.G, sub)
	require.NoError(t, err)

	require.EqualValues(t, 2, after.Generation())
	secretAfter := after.Data.PerTeamKeySeedsUnverified[after.Generation()].Seed.ToBytes()
	require.False(t, libkb.SecureByteArrayEq(secretAfter, secretBefore))

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
	tc.G.Logout(context.TODO())
	require.NoError(t, otherA.Login(tc.G))

	// otherA has the power to add otherB to the subteam
	res, err := AddMember(context.TODO(), tc.G, sub, otherB.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	require.Equal(t, res.User.Username, otherB.Username)
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

	for i := 0; i < 10; i++ {
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
	tc.G.Logout(context.TODO())

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
		tc.G.Logout(context.TODO())
		require.NoError(t, u.Login(tc.G))

		kbtest.ResetAccount(tc, u)
	}

	tc.G.Logout(context.TODO())
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
	tc.G.Logout(context.TODO())
	require.NoError(t, otherB.Login(tc.G))
	kbtest.ResetAccount(tc, otherB)

	// Re-login as owner, simulate CLKR message.
	tc.G.Logout(context.TODO())
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
	tc.G.Logout(context.TODO())
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
		tc.G.Logout(context.TODO())
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

	tc.G.Logout(context.TODO())
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

func TestRotateResetSweepWithWriter(t *testing.T) {
	// Scenario where CLKR with ResetUsersUntrusted is sent to a
	// writer. They can't remove reset people, but they should rotate
	// anyway.

	tc, _, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	err := ChangeTeamSettings(context.Background(), tc.G, name, keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherA.Username))
	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherB.Username))

	// Login as otherB, reset account.
	tc.G.Logout(context.TODO())
	require.NoError(t, otherB.Login(tc.G))
	kbtest.ResetAccount(tc, otherB)

	// Login as otherA (writer), simulate CLKR with info about reset
	// otherB.
	tc.G.Logout(context.TODO())
	require.NoError(t, otherA.Login(tc.G))

	team, err := GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	params := keybase1.TeamCLKRMsg{
		TeamID:     team.ID,
		Generation: team.Generation(),
		ResetUsersUntrusted: []keybase1.TeamCLKRResetUser{
			keybase1.TeamCLKRResetUser{
				Uid:               otherB.User.GetUID(),
				UserEldestSeqno:   keybase1.Seqno(0),
				MemberEldestSeqno: keybase1.Seqno(1),
			}},
	}
	err = HandleRotateRequest(context.Background(), tc.G, params)
	require.NoError(t, err)

	team, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)
	require.EqualValues(t, 2, team.Generation())
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

func TestRotateAsSubteamWriter(t *testing.T) {
	// subteam has a single writer who is not part of the parent team.
	// scenario manifested itself in CORE-8681
	tc, _, _, otherB, _, sub := memberSetupSubteam(t)
	defer tc.Cleanup()

	team, err := GetForTestByStringName(context.TODO(), tc.G, sub)
	require.NoError(t, err)
	oldGeneration := team.Generation()

	res, err := AddMember(context.TODO(), tc.G, sub, otherB.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	require.Equal(t, res.User.Username, otherB.Username)
	// otherB should now be a writer
	assertRole(tc, sub, otherB.Username, keybase1.TeamRole_WRITER)

	tc.G.Logout(context.TODO())
	require.NoError(t, otherB.Login(tc.G))

	params := keybase1.TeamCLKRMsg{
		TeamID:              team.ID,
		Generation:          oldGeneration,
		ResetUsersUntrusted: nil,
	}
	err = HandleRotateRequest(context.Background(), tc.G, params)
	require.NoError(t, err)

	teamAfter, err := GetForTestByStringName(context.Background(), tc.G, sub)
	require.NoError(t, err)
	require.EqualValues(t, oldGeneration+1, teamAfter.Generation())
}

func TestDowngradeImplicitAdminAfterReset(t *testing.T) {
	tc, owner, otherA, otherB, root, sub := memberSetupSubteam(t)
	defer tc.Cleanup()

	_, err := AddMember(context.TODO(), tc.G, sub, otherA.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	// Reset and reprovision implicit admin
	tc.G.Logout(context.TODO())
	require.NoError(t, otherA.Login(tc.G))
	kbtest.ResetAccount(tc, otherA)
	require.NoError(t, otherA.Login(tc.G))

	tc.G.Logout(context.TODO())
	require.NoError(t, owner.Login(tc.G))

	_, err = GetForTestByStringName(context.Background(), tc.G, root)
	require.NoError(t, err)

	_, err = AddMember(context.TODO(), tc.G, root, otherA.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	err = EditMember(context.TODO(), tc.G, root, otherA.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// This fails if a box incorrectly remains live for otherA after the downgrade due
	// to bad team key coverage.
	_, err = AddMember(context.TODO(), tc.G, sub, otherB.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
}

func TestRotationWhenClosingOpenTeam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	tryCloseTeam := func(rotateWithSettings bool) {
		t.Logf("tryCloseTeam(rotateWithSettings=%t)", rotateWithSettings)

		b, err := libkb.RandBytes(4)
		require.NoError(tc.T, err)

		teamName := hex.EncodeToString(b)
		_, err = CreateRootTeam(context.Background(), tc.G, teamName, keybase1.TeamSettings{
			Open:   true,
			JoinAs: keybase1.TeamRole_WRITER,
		})
		require.NoError(tc.T, err)

		teamObj, err := GetForTestByStringName(context.Background(), tc.G, teamName)
		require.NoError(t, err)

		currentGen := teamObj.Generation()
		if rotateWithSettings {
			err = teamObj.PostTeamSettings(context.Background(), keybase1.TeamSettings{
				Open: false,
			}, true /* rotate */)
			require.NoError(t, err)
		} else {
			err = ChangeTeamSettings(context.Background(), tc.G, teamName, keybase1.TeamSettings{
				Open: false,
			})
			require.NoError(t, err)
		}

		teamObj, err = GetForTestByStringName(context.Background(), tc.G, teamName)
		require.NoError(t, err)                              // ensures team settings link did not break loading
		require.Equal(t, currentGen+1, teamObj.Generation()) // and we got new per team key
	}

	// Try to close team using PostTeamSettings(rotate=true) which posts
	// TeamSettings link with per-team-key in it. So it closes team and rotates
	// key in one link.
	tryCloseTeam(true)

	// Close team using ChangeTeamSettings service_helper API, which posts two
	// links, to stay compatible with older clients sigchain parsers.
	tryCloseTeam(false)
}

func TestRemoveFromOpenTeam(t *testing.T) {
	// Removals from open teams should not cause rotation.
	tc, _, otherA, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	err := ChangeTeamSettings(context.Background(), tc.G, name, keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	teamObj, err := GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	currentGen := teamObj.Generation()
	err = SetRoleWriter(context.Background(), tc.G, name, otherA.Username)
	require.NoError(t, err)

	err = RemoveMember(context.Background(), tc.G, name, otherA.Username)
	require.NoError(t, err)

	// Expecting generation to stay the same after removal.
	teamObj, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, currentGen, teamObj.Generation())
}

func TestOpenSweepHandler(t *testing.T) {
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherA.Username))
	require.NoError(t, SetRoleWriter(context.Background(), tc.G, name, otherB.Username))

	otherBUV := otherB.User.ToUserVersion()

	// Login as otherB, reset account.
	tc.G.Logout(context.TODO())
	require.NoError(t, otherB.Login(tc.G))
	kbtest.ResetAccount(tc, otherB)

	// Login as owner, try to simulate OPENSWEEP, should fail because it's a
	// closed team.
	tc.G.Logout(context.TODO())
	require.NoError(t, owner.Login(tc.G))

	team, err := GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	// Make sure we have the right UV that we are going to check later if it's
	// sweeped out.
	require.True(t, team.IsMember(context.TODO(), otherBUV))

	params := keybase1.TeamOpenSweepMsg{
		TeamID: team.ID,
		ResetUsersUntrusted: []keybase1.TeamCLKRResetUser{
			keybase1.TeamCLKRResetUser{
				Uid:               otherB.User.GetUID(),
				UserEldestSeqno:   keybase1.Seqno(0),
				MemberEldestSeqno: otherBUV.EldestSeqno,
			}},
	}
	err = HandleOpenTeamSweepRequest(context.Background(), tc.G, params)
	require.Error(t, err)

	// Change settings to open team.
	err = ChangeTeamSettings(context.Background(), tc.G, name, keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	// Login as otherA (writer), simulate OPENSWEEP, should fail
	// because it only works with admins.
	tc.G.Logout(context.TODO())
	require.NoError(t, otherA.Login(tc.G))

	err = HandleOpenTeamSweepRequest(context.Background(), tc.G, params)
	require.Error(t, err)

	// Back to owner, should work now.
	tc.G.Logout(context.TODO())
	require.NoError(t, owner.Login(tc.G))

	err = HandleOpenTeamSweepRequest(context.Background(), tc.G, params)
	require.NoError(t, err)

	team, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)
	// Generation should not have advanced after OPENSWEEP.
	require.EqualValues(t, 1, team.Generation())
	// OtherB should not be a member anymore.
	require.False(t, team.IsMember(context.TODO(), otherBUV))
	// This leaves two remaining members.
	members, err := team.Members()
	require.NoError(t, err)
	require.Len(t, members.AllUserVersions(), 2)

	curSeqno := team.CurrentSeqno()

	// Repeating the same request should be a no-op, not post any links, etc.
	err = HandleOpenTeamSweepRequest(context.Background(), tc.G, params)
	require.NoError(t, err)

	team, err = GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, curSeqno, team.CurrentSeqno())
	require.EqualValues(t, 1, team.Generation())
}
