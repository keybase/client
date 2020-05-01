package teams

import (
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/engine"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

func memberSetupWithID(t *testing.T) (libkb.TestContext, *kbtest.FakeUser, string, keybase1.TeamID) {
	tc := SetupTest(t, "team", 1)

	u, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	name, ID := createTeam2(tc)

	t.Logf("User name is: %s", u.Username)
	t.Logf("Team name is: %s", name)
	return tc, u, name.String(), ID
}

func memberSetup(t *testing.T) (libkb.TestContext, *kbtest.FakeUser, string) {
	tc, u, name, _ := memberSetupWithID(t)
	return tc, u, name
}

func memberSetupMultiple(t *testing.T) (tc libkb.TestContext, owner, otherA, otherB *kbtest.FakeUser, name string) {
	tc = SetupTest(t, "team", 1)

	otherA, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	otherB, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	owner, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name = createTeam(tc)
	t.Logf("Created team %q", name)

	return tc, owner, otherA, otherB, name
}

func memberSetupMultipleWithTeamID(t *testing.T) (tc libkb.TestContext, owner, otherA, otherB *kbtest.FakeUser, name keybase1.TeamName, teamID keybase1.TeamID) {
	tc = SetupTest(t, "team", 1)

	otherA, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	otherB, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	owner, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name, teamID = createTeam2(tc)
	t.Logf("Created team %q", name)

	return tc, owner, otherA, otherB, name, teamID
}

// creates a root team and a subteam.  owner is the owner of root, otherA is an admin, otherB is just a user.
// no members in subteam.
func memberSetupSubteam(t *testing.T) (tc libkb.TestContext, owner, otherA, otherB *kbtest.FakeUser, root, sub string) {
	tc, owner, otherA, otherB, root = memberSetupMultiple(t)

	t.Logf("mss owner: %v", owner.Username)
	t.Logf("mss otherA: %v", otherA.Username)
	t.Logf("mss otherB: %v", otherB.Username)

	// add otherA and otherB as admins to rootName
	_, err := AddMember(context.TODO(), tc.G, root, otherA.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	assertRole(tc, root, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, root, otherA.Username, keybase1.TeamRole_ADMIN)
	assertRole(tc, root, otherB.Username, keybase1.TeamRole_NONE)

	// create a subteam
	rootTeamName, err := keybase1.TeamNameFromString(root)
	require.NoError(t, err)

	subPart := "sub"
	_, err = CreateSubteam(context.TODO(), tc.G, subPart, rootTeamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	sub = root + "." + subPart

	// make sure owner, otherA, otherB are not members
	assertRole(tc, sub, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, otherA.Username, keybase1.TeamRole_NONE)
	assertRole(tc, sub, otherB.Username, keybase1.TeamRole_NONE)

	return tc, owner, otherA, otherB, root, sub
}

func TestMemberOwner(t *testing.T) {
	tc, u, name := memberSetup(t)
	defer tc.Cleanup()

	assertRole(tc, name, u.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, "t_alice", keybase1.TeamRole_NONE)
}

type setRoleTest struct {
	name        string //nolint
	setRoleFunc func(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error
	afterRole   keybase1.TeamRole
}

func setRestrictedBotRole(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return SetRoleRestrictedBot(ctx, g, teamname, username, keybase1.TeamBotSettings{})
}

var setRoleTests = []setRoleTest{
	{name: "owner", setRoleFunc: SetRoleOwner, afterRole: keybase1.TeamRole_OWNER},
	{name: "admin", setRoleFunc: SetRoleAdmin, afterRole: keybase1.TeamRole_ADMIN},
	{name: "writer", setRoleFunc: SetRoleWriter, afterRole: keybase1.TeamRole_WRITER},
	{name: "reader", setRoleFunc: SetRoleReader, afterRole: keybase1.TeamRole_READER},
	{name: "bot", setRoleFunc: SetRoleBot, afterRole: keybase1.TeamRole_BOT},
	{name: "restricted_bot", setRoleFunc: setRestrictedBotRole, afterRole: keybase1.TeamRole_RESTRICTEDBOT},
}

func TestMemberSetRole(t *testing.T) {
	for _, test := range setRoleTests {
		testMemberSetRole(t, test)
	}
}

func testMemberSetRole(t *testing.T, test setRoleTest) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := test.setRoleFunc(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, test.afterRole)
}

func TestMemberAddOK(t *testing.T) {
	tc, _, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)

	res, err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.User.Username != other.Username {
		t.Errorf("AddMember result username %q does not match arg username %q", res.User.Username, other.Username)
	}

	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)

	// second AddMember should return err
	if _, err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole_WRITER, nil); err == nil {
		t.Errorf("second AddMember succeeded, should have failed since user already a member")
	}

	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)
}

func TestMembersEdit(t *testing.T) {
	tc, _, otherA, otherB, name, teamID := memberSetupMultipleWithTeamID(t)
	defer tc.Cleanup()

	assertRole(tc, name.String(), otherA.Username, keybase1.TeamRole_NONE)

	_, err := AddMember(context.TODO(), tc.G, name.String(), otherA.Username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name.String(), otherA.Username, keybase1.TeamRole_READER)

	assertRole(tc, name.String(), otherB.Username, keybase1.TeamRole_NONE)

	_, err = AddMember(context.TODO(), tc.G, name.String(), otherB.Username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name.String(), otherB.Username, keybase1.TeamRole_READER)

	rolePairA := keybase1.UserRolePair{
		Assertion:   otherA.Username,
		Role:        keybase1.TeamRole_READER,
		BotSettings: nil,
	}

	rolePairB := keybase1.UserRolePair{
		Assertion:   otherB.Username,
		Role:        keybase1.TeamRole_ADMIN,
		BotSettings: nil,
	}

	userRolePairs := []keybase1.UserRolePair{rolePairA, rolePairB}

	res, err := EditMembers(context.TODO(), tc.G, teamID, userRolePairs)
	require.NoError(t, err)
	require.Empty(t, res.Failures)
}

func TestMemberAddBot(t *testing.T) {
	tc, _, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	err = team.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
	require.NoError(t, err)

	assertRole(tc, name, otherA.Username, keybase1.TeamRole_NONE)
	assertRole(tc, name, otherB.Username, keybase1.TeamRole_NONE)

	res, err := AddMember(context.TODO(), tc.G, name, otherA.Username, keybase1.TeamRole_BOT, nil)
	require.NoError(t, err)
	require.Equal(t, otherA.Username, res.User.Username)
	assertRole(tc, name, otherA.Username, keybase1.TeamRole_BOT)

	// When changing to a restricted bot, botSettings are required.
	err = EditMember(context.TODO(), tc.G, name, otherA.Username, keybase1.TeamRole_RESTRICTEDBOT, nil)
	require.Error(t, err)

	err = EditMember(context.TODO(), tc.G, name, otherA.Username, keybase1.TeamRole_RESTRICTEDBOT, &keybase1.TeamBotSettings{Cmds: true})
	require.NoError(t, err)
	assertRole(tc, name, otherA.Username, keybase1.TeamRole_RESTRICTEDBOT)

	// botSettings is required.
	res, err = AddMember(context.TODO(), tc.G, name, otherB.Username, keybase1.TeamRole_RESTRICTEDBOT, nil)
	require.Error(t, err)

	res, err = AddMember(context.TODO(), tc.G, name, otherB.Username, keybase1.TeamRole_RESTRICTEDBOT,
		&keybase1.TeamBotSettings{Mentions: true})
	require.NoError(t, err)
	require.Equal(t, otherB.Username, res.User.Username)
	assertRole(tc, name, otherB.Username, keybase1.TeamRole_RESTRICTEDBOT)

	// make sure the bot settings links are present
	team, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	teamBotSettings, err := team.TeamBotSettings()
	require.NoError(t, err)
	require.Len(t, teamBotSettings, 2)
	require.Equal(t, keybase1.TeamBotSettings{Cmds: true}, teamBotSettings[otherA.GetUserVersion()])
	require.Equal(t, keybase1.TeamBotSettings{Mentions: true}, teamBotSettings[otherB.GetUserVersion()])

	// second AddMember should return err
	_, err = AddMember(context.TODO(), tc.G, name, otherA.Username, keybase1.TeamRole_WRITER, nil)
	require.Error(t, err)
	assertRole(tc, name, otherA.Username, keybase1.TeamRole_RESTRICTEDBOT)

	_, err = AddMember(context.TODO(), tc.G, name, otherB.Username, keybase1.TeamRole_WRITER, nil)
	require.Error(t, err)
	assertRole(tc, name, otherB.Username, keybase1.TeamRole_RESTRICTEDBOT)
}

func TestMemberAddInvalidRole(t *testing.T) {
	tc, _, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if _, err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole(8888), nil); err == nil {
		t.Errorf("AddMember worked with invalid role")
	}

	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)
}

// getFindNextMerkleRootAfterRemoval calls out to teams.FindNextMerkleRootAfterRemoval, which is
// a thin wrapper around libkb.FindNextMerkleRootAfterTeamRemoval.
func getFindNextMerkleRootAfterRemoval(t *testing.T, tc libkb.TestContext, user *kbtest.FakeUser, id keybase1.TeamID, anyRoleAllowed bool) (res keybase1.NextMerkleRootRes, err error) {
	m := libkb.NewMetaContextForTest(tc)
	upak, _, err := tc.G.GetUPAKLoader().LoadV2(libkb.NewLoadUserArgWithMetaContext(m).WithUID(user.GetUID()))
	require.NoError(t, err)
	require.NotNil(t, upak)
	var signingKey keybase1.KID
	for kid, obj := range upak.Current.DeviceKeys {
		if obj.Base.IsSibkey {
			signingKey = kid
			break
		}
	}
	require.False(t, signingKey.IsNil())
	return FindNextMerkleRootAfterRemoval(m, keybase1.FindNextMerkleRootAfterTeamRemovalBySigningKeyArg{
		Uid:            user.GetUID(),
		SigningKey:     signingKey,
		IsPublic:       false,
		Team:           id,
		AnyRoleAllowed: anyRoleAllowed,
	})
}

// Check that `libkb.FindNextMerkleRootAfterTeamRemoval` works. To do so,
// find the logpoint on the team where the user was removed, and pass it in.
// Check for success simply by asserting that the Merkle Root seqno bumps
// forward after the removal went into the team sigchain.
func pollForNextMerkleRootAfterRemovalViaLibkb(t *testing.T, tc libkb.TestContext, user *kbtest.FakeUser, teamName string) (tid keybase1.TeamID, seqno keybase1.Seqno) {

	m := libkb.NewMetaContextForTest(tc)
	team, err := GetForTestByStringName(context.TODO(), tc.G, teamName)
	require.NoError(t, err)
	logPoint := team.chain().GetUserLogPoint(user.GetUserVersion())
	require.NotNil(t, logPoint)

	var delay time.Duration

	// Unfortunately we need to poll here, since we don't know when merkled will mint a new root.
	// Locally it is fast, but it might be slowish on CI.
	for i := 0; i < 50; i++ {
		res, err := libkb.FindNextMerkleRootAfterTeamRemoval(m, keybase1.FindNextMerkleRootAfterTeamRemovalArg{
			Uid:               user.GetUID(),
			Team:              team.ID,
			IsPublic:          team.IsPublic(),
			TeamSigchainSeqno: logPoint.SigMeta.SigChainLocation.Seqno,
			Prev:              logPoint.SigMeta.PrevMerkleRootSigned,
		})

		// Success case!
		if err == nil {
			require.NotNil(t, res.Res)
			require.True(t, res.Res.Seqno > logPoint.SigMeta.PrevMerkleRootSigned.Seqno)
			return team.ID, res.Res.Seqno
		}

		if merr, ok := err.(libkb.MerkleClientError); ok && merr.IsNotFound() {
			t.Logf("Failed to find a root, trying again to wait for merkled")
		} else {
			require.NoError(t, err)
			return tid, seqno
		}

		if delay < time.Second {
			delay += 10 * time.Millisecond
		}
		t.Logf("sleeping %v", delay)
		time.Sleep(delay)
	}
	t.Fatalf("failed to find a suitable merkle root with team removal")
	return tid, seqno
}

func TestMemberRemoveReader(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	anyRoleAllowed := true
	if err := SetRoleReader(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)

	if err := RemoveMember(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)

	teamID, expectedSeqno := pollForNextMerkleRootAfterRemovalViaLibkb(t, tc, other, name)
	res, err := getFindNextMerkleRootAfterRemoval(t, tc, other, teamID, anyRoleAllowed)

	require.NoError(t, err)
	require.NotNil(t, res.Res)
	require.Equal(t, res.Res.Seqno, expectedSeqno)
}

// Set up log points for a user in a team with roles of
// Writer->Reader->Writer->Reader and verify that the first merkle root
// after the last demotion from writer points to the last sequence number.
func TestMemberRemoveWriter(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	anyRoleAllowed := false
	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	if err := SetRoleReader(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	if err := SetRoleReader(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)

	teamID, expectedSeqno := pollForNextMerkleRootAfterRemovalViaLibkb(t, tc, other, name)
	res, err := getFindNextMerkleRootAfterRemoval(t, tc, other, teamID, anyRoleAllowed)

	require.NoError(t, err)
	require.NotNil(t, res.Res)
	require.Equal(t, res.Res.Seqno, expectedSeqno)
}

func TestMemberRemoveWithoutDemotion(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	anyRoleAllowed := true
	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	res, err := getFindNextMerkleRootAfterRemoval(t, tc, other, team.ID, anyRoleAllowed)

	require.Nil(t, res.Res)
	require.Error(t, err)
	require.IsType(t, libkb.NotFoundError{}, err)
}

func TestMembersRemove(t *testing.T) {
	tc, _, otherA, otherB, name, teamID := memberSetupMultipleWithTeamID(t)
	defer tc.Cleanup()

	assertRole(tc, name.String(), otherA.Username, keybase1.TeamRole_NONE)

	_, err := AddMember(context.TODO(), tc.G, name.String(), otherA.Username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name.String(), otherA.Username, keybase1.TeamRole_READER)

	assertRole(tc, name.String(), otherB.Username, keybase1.TeamRole_NONE)

	_, err = AddMember(context.TODO(), tc.G, name.String(), otherB.Username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name.String(), otherB.Username, keybase1.TeamRole_READER)

	rolePairA := keybase1.NewTeamMemberToRemoveWithAssertion(keybase1.AssertionTeamMemberToRemove{
		Assertion:         otherA.Username,
		RemoveFromSubtree: false,
	})
	rolePairB := keybase1.NewTeamMemberToRemoveWithAssertion(keybase1.AssertionTeamMemberToRemove{
		Assertion:         otherB.Username,
		RemoveFromSubtree: false,
	})

	users := []keybase1.TeamMemberToRemove{rolePairA, rolePairB}

	res, err := RemoveMembers(context.TODO(), tc.G, teamID, users, false)

	assertRole(tc, name.String(), otherA.Username, keybase1.TeamRole_NONE)
	assertRole(tc, name.String(), otherB.Username, keybase1.TeamRole_NONE)

	require.NoError(t, err)
	require.Empty(t, res.Failures)
}

// make sure that adding a member creates new recipient boxes
func TestMemberAddHasBoxes(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)

	// this change request should generate boxes since other.Username
	// is not a member
	req := keybase1.TeamChangeReq{Readers: []keybase1.UserVersion{other.GetUserVersion()}}
	tm, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	_, boxes, _, _, _, _, err := tm.changeMembershipSection(context.TODO(), req, false /* skipKeyRotation */)
	if err != nil {
		t.Fatal(err)
	}
	if boxes == nil || len(boxes.Boxes) == 0 {
		t.Errorf("add member failed to make new boxes")
	}
}

// make sure that changing a role does not send new boxes for the
// member to the server
func TestMemberChangeRoleNoBoxes(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)

	// add other.Username as a writer
	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	// this change request shouldn't generate any new boxes
	req := keybase1.TeamChangeReq{Readers: []keybase1.UserVersion{other.GetUserVersion()}}
	tm, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	_, boxes, _, _, _, _, err := tm.changeMembershipSection(context.TODO(), req, false /* skipKeyRotation */)
	if err != nil {
		t.Fatal(err)
	}
	if boxes != nil && len(boxes.Boxes) > 0 {
		t.Errorf("change role made new boxes: %+v", boxes)
	}
}

func TestMemberRemoveRotatesKeys(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	before, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if before.Generation() != 1 {
		t.Fatalf("initial team generation: %d, expected 1", before.Generation())
	}

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	if err := RemoveMember(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)

	after, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if after.Generation() != 2 {
		t.Errorf("after member remove: team generation: %d, expected 2", after.Generation())
	}

	secretAfter := after.Data.PerTeamKeySeedsUnverified[after.Generation()].Seed.ToBytes()
	secretBefore := before.Data.PerTeamKeySeedsUnverified[before.Generation()].Seed.ToBytes()
	if libkb.SecureByteArrayEq(secretAfter, secretBefore) {
		t.Error("Team secret did not change when member removed")
	}
}

func TestMemberAddNotAUser(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	tc.G.SetProofServices(externals.NewProofServices(tc.G))

	_, err := AddMember(context.TODO(), tc.G, name, "not_a_kb_user", keybase1.TeamRole_READER, nil)
	if err == nil {
		t.Fatal("Added a non-keybase username to a team")
	}
	if _, ok := err.(libkb.NotFoundError); !ok {
		t.Errorf("error: %s (%T), expected libkb.NotFoundError", err, err)
	}
}

func TestMemberAddSocial(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	tc.G.SetProofServices(externals.NewProofServices(tc.G))

	_, err := AddMember(context.TODO(), tc.G, name, "not_on_kb_yet@twitter", keybase1.TeamRole_OWNER, nil)
	require.Error(t, err, "should not be able to invite a social user as an owner")

	res, err := AddMember(context.TODO(), tc.G, name, "not_on_kb_yet@twitter", keybase1.TeamRole_READER, nil)
	require.NoError(t, err)
	require.True(t, res.Invited)

	assertInvite(tc, name, "not_on_kb_yet", "twitter", keybase1.TeamRole_READER)

	// second AddMember should return err
	_, err = AddMember(context.TODO(), tc.G, name, "not_on_kb_yet@twitter", keybase1.TeamRole_WRITER, nil)
	require.Error(t, err, "second AddMember should fail since user already invited")

	// existing invite should be untouched
	assertInvite(tc, name, "not_on_kb_yet", "twitter", keybase1.TeamRole_READER)
}

// add user without puk to a team, should create invite link
func TestMemberAddNoPUK(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	inviteNoPUK := func(username string, uid keybase1.UID, role keybase1.TeamRole) {

		res, err := AddMember(context.TODO(), tc.G, name, username, role, nil)
		if err != nil {
			t.Fatal(err)
		}
		if !res.Invited {
			t.Fatal("res.Invited should be set")
		}
		if res.User.Username != username {
			t.Errorf("AddMember result username %q does not match arg username %q", res.User.Username, username)
		}

		fqUID := string(uid) + "%1"
		assertInvite(tc, name, fqUID, "keybase", role)

		// second AddMember should return err
		if _, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_WRITER, nil); err == nil {
			t.Errorf("second AddMember succeeded, should have failed since user already invited")
		}

		// existing invite should be untouched
		assertInvite(tc, name, fqUID, "keybase", role)
	}

	inviteNoPUK("t_alice", keybase1.UID("295a7eea607af32040647123732bc819"), keybase1.TeamRole_READER)

	// Disabled until we back out CORE-6170
	// inviteNoPUK("t_bob", keybase1.UID("afb5eda3154bc13c1df0189ce93ba119"), keybase1.TeamRole_OWNER)
}

// add user without keys to a team, should create invite link
func TestMemberAddNoKeys(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	username := "t_ellen"
	res, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Invited {
		t.Fatal("res.Invited should be set")
	}
	if res.User.Username != username {
		t.Errorf("AddMember result username %q does not match arg username %q", res.User.Username, username)
	}

	assertInvite(tc, name, "561247eb1cc3b0f5dc9d9bf299da5e19%0", "keybase", keybase1.TeamRole_READER)

	// second AddMember should return err
	if _, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_WRITER, nil); err == nil {
		t.Errorf("second AddMember succeeded, should have failed since user already invited")
	}

	// existing invite should be untouched
	assertInvite(tc, name, "561247eb1cc3b0f5dc9d9bf299da5e19%0", "keybase", keybase1.TeamRole_READER)

	// this is a keybase user, so they should show up in the member list
	// even though they are technically only "invited"
	details, err := Details(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, m := range details.Members.Readers {
		if m.Username == username {
			found = true
			break
		}
		t.Logf("not a match: %s != %s", m.Username, username)
	}
	if !found {
		t.Fatal("keybase invited user not in membership list")
	}
}

func TestMemberDetailsResetAndDeletedUser(t *testing.T) {
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	tc.G.UIDMapper.SetTestingNoCachingMode(true)
	_, err := AddMember(context.TODO(), tc.G, name, otherA.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	_, err = AddMember(context.TODO(), tc.G, name, otherB.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	details, err := Details(context.TODO(), tc.G, name)
	require.NoError(t, err)

	require.Len(t, details.Members.Admins, 2)
	for _, admin := range details.Members.Admins {
		require.Equal(t, admin.Status, keybase1.TeamMemberStatus_ACTIVE)
	}

	// Logout owner
	kbtest.Logout(tc)

	err = otherA.Login(tc.G)
	require.NoError(t, err)
	kbtest.ResetAccount(tc, otherA)

	err = otherB.Login(tc.G)
	require.NoError(t, err)
	kbtest.DeleteAccount(tc, otherB)

	err = owner.Login(tc.G)
	require.NoError(t, err)

	details, err = Details(context.TODO(), tc.G, name)
	require.NoError(t, err)

	require.Len(t, details.Members.Admins, 1)
	require.Equal(t, otherA.Username, details.Members.Admins[0].Username)
	require.Equal(t, keybase1.TeamMemberStatus_RESET, details.Members.Admins[0].Status)
}

func TestMemberAddEmail(t *testing.T) {
	tc, _, name, teamID := memberSetupWithID(t)
	defer tc.Cleanup()

	address := "noone@keybase.io"

	if err := InviteEmailPhoneMember(context.TODO(), tc.G, teamID, address, "email", keybase1.TeamRole_OWNER); err == nil {
		t.Fatal("should not be able to invite an owner over email")
	}

	if err := InviteEmailPhoneMember(context.TODO(), tc.G, teamID, address, "email", keybase1.TeamRole_READER); err != nil {
		t.Fatal(err)
	}

	assertInvite(tc, name, address, "email", keybase1.TeamRole_READER)

	// second InviteEmailPhoneMember should return err
	if err := InviteEmailPhoneMember(context.TODO(), tc.G, teamID, address, "email", keybase1.TeamRole_WRITER); err == nil {
		t.Errorf("second InviteEmailMember succeeded, should have failed since user already invited")
	}

	// existing invite should be untouched
	assertInvite(tc, name, address, "email", keybase1.TeamRole_READER)

	details, err := Details(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, invite := range details.AnnotatedActiveInvites {
		if invite.TeamName == name && string(invite.InviteMetadata.Invite.Name) == address {
			found = true
		}
	}
	if !found {
		t.Fatal("List team does not list invite.")
	}
}

func TestMemberAddEmailBulk(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	existingUserEmail := kbtest.GenerateRandomEmailAddress(t)
	blob := string(existingUserEmail) + ", h@j.k,u1@keybase.io, u2@keybase.io\nu3@keybase.io,u4@keybase.io, u5@keybase.io,u6@keybase.io, u7@keybase.io\n\n\nFull Name <fullname@keybase.io>, Someone Else <someone@keybase.io>,u8@keybase.io\n\nXXXXXXXXXXXX"

	// create a user with a searchable email to test addEmailsBulk resolves existing users correctly.
	tc2 := SetupTest(t, "team", 1)
	u2, err := kbtest.CreateAndSignupFakeUser("team", tc2.G)
	require.NoError(t, err)
	err = emails.AddEmail(tc2.MetaContext(), existingUserEmail, keybase1.IdentityVisibility_PUBLIC)
	require.NoError(t, err)
	err = kbtest.VerifyEmailAuto(tc2.MetaContext(), existingUserEmail)
	require.NoError(t, err)

	res, err := AddEmailsBulk(context.TODO(), tc.G, name, blob, keybase1.TeamRole_WRITER)
	if err != nil {
		t.Fatal(err)
	}
	emails := []string{"u1@keybase.io", "u2@keybase.io", "u3@keybase.io", "u4@keybase.io", "u5@keybase.io", "u6@keybase.io", "u7@keybase.io", "fullname@keybase.io", "someone@keybase.io", "u8@keybase.io"}

	require.Len(t, res.Malformed, 2)
	for _, e := range emails {
		assertInvite(tc, name, e, "email", keybase1.TeamRole_WRITER)
	}

	assertRole(tc, name, u2.Username, keybase1.TeamRole_WRITER)
}

func TestMemberListInviteUsername(t *testing.T) {
	tc, user, name := memberSetup(t)
	defer tc.Cleanup()

	username := "t_ellen"
	res, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)
	require.True(t, res.Invited)
	require.Equal(t, username, res.User.Username)

	// List can return stale results for invites, so do a force load of the team to refresh the cache.
	// In the real world, hopefully gregor would cause this.
	_, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	annotatedTeamList, err := ListAll(context.TODO(), tc.G, keybase1.TeamListTeammatesArg{})
	require.NoError(t, err)
	require.Equal(t, 1, len(annotatedTeamList.Teams), "ListAll doesn't include keybase invites")

	require.Equal(t, user.Username, annotatedTeamList.Teams[0].Username)
	require.Equal(t, name, annotatedTeamList.Teams[0].FqName)
}

func TestMemberAddAsImplicitAdmin(t *testing.T) {
	tc, owner, otherA, otherB, _, subteamName := memberSetupSubteam(t)
	defer tc.Cleanup()

	// owner created a subteam, otherA is implicit admin, otherB is nobody
	// (all of that tested in memberSetupSubteam)

	switchTo := func(to *kbtest.FakeUser) {
		err := tc.Logout()
		require.NoError(t, err)
		err = to.Login(tc.G)
		require.NoError(t, err)
	}

	switchTo(otherA)

	// otherA has the power to add otherB to the subteam
	res, err := AddMember(context.TODO(), tc.G, subteamName, otherB.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	require.Equal(t, otherB.Username, res.User.Username, "AddMember result username does not match arg")
	// otherB should now be a writer
	assertRole(tc, subteamName, otherB.Username, keybase1.TeamRole_WRITER)

	// owner, otherA should still be non-members
	assertRole(tc, subteamName, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, subteamName, otherA.Username, keybase1.TeamRole_NONE)

	switchTo(otherB)
	// Test ImplicitAdmins
	subteamName2, err := keybase1.TeamNameFromString(subteamName)
	require.NoError(t, err)
	subteamID, err := ResolveNameToID(context.TODO(), tc.G, subteamName2)
	require.NoError(t, err)

	ias, err := tc.G.GetTeamLoader().ImplicitAdmins(context.TODO(), subteamID)
	// ias, err := ImplicitAdmins(context.TODO(), tc.G, subteamID)
	require.NoError(t, err)
	t.Logf("res: %v", spew.Sdump(ias))
	require.Len(t, ias, 2, "number of implicit admins")
	sort.Slice(ias, func(i, _ int) bool {
		return ias[i].Eq(owner.GetUserVersion())
	})
	require.Equal(t, owner.GetUserVersion(), ias[0])
	require.Equal(t, otherA.GetUserVersion(), ias[1])
}

func TestLeave(t *testing.T) {
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	botua, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)
	err = owner.Login(tc.G)
	require.NoError(t, err)

	restrictedBotua, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)
	err = owner.Login(tc.G)
	require.NoError(t, err)

	err = SetRoleAdmin(context.TODO(), tc.G, name, otherA.Username)
	require.NoError(t, err)
	err = SetRoleWriter(context.TODO(), tc.G, name, otherB.Username)
	require.NoError(t, err)
	err = SetRoleBot(context.TODO(), tc.G, name, botua.Username)
	require.NoError(t, err)
	err = SetRoleRestrictedBot(context.TODO(), tc.G, name, restrictedBotua.Username, keybase1.TeamBotSettings{})
	require.NoError(t, err)

	err = tc.Logout()
	require.NoError(t, err)

	err = otherA.Login(tc.G)
	require.NoError(t, err)
	err = Leave(context.TODO(), tc.G, name, false)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	err = otherB.Login(tc.G)
	require.NoError(t, err)
	err = Leave(context.TODO(), tc.G, name, false)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	err = botua.Login(tc.G)
	require.NoError(t, err)
	err = Leave(context.TODO(), tc.G, name, false)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	err = restrictedBotua.Login(tc.G)
	require.NoError(t, err)
	err = Leave(context.TODO(), tc.G, name, false)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	err = owner.Login(tc.G)
	require.NoError(t, err)
	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)

	require.False(t, team.IsMember(context.TODO(), otherA.GetUserVersion()))
	require.False(t, team.IsMember(context.TODO(), otherB.GetUserVersion()))
	require.False(t, team.IsMember(context.TODO(), botua.GetUserVersion()))
	require.False(t, team.IsMember(context.TODO(), restrictedBotua.GetUserVersion()))
}

func TestImplicitAdminBecomesExplicit(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("u0 creates a team (seqno:1)")
	teamName, _ := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to the team (2)")
	_, err := AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	t.Logf("U0 makes a subteam")
	subteamNameParsed, subteamID := createSubteam(tcs[0], teamName, "subteam")
	subteamName := subteamNameParsed.String()

	t.Logf("U0 adds themself as an admin to the subteam")
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName, fus[0].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	t.Logf("U0 rotates the subteam 3 times")
	subteam, err := GetForTestByID(context.TODO(), tcs[0].G, subteamID)
	require.NoError(t, err)
	for i := 0; i < 3; i++ {
		err = subteam.Rotate(context.TODO(), keybase1.RotationType_HIDDEN)
		require.NoError(t, err)
		subteam, err = GetForTestByID(context.TODO(), tcs[0].G, subteamID)
		require.NoError(t, err)
	}

	t.Logf("U1 fails to read the SALTPACK RKM at gen=4")
	subteamPartial, err := GetForTestByID(context.TODO(), tcs[1].G, subteamID)
	require.NoError(t, err)
	mctx := libkb.NewMetaContextForTest(*tcs[1])
	_, err = ApplicationKeyAtGeneration(mctx, subteamPartial, keybase1.TeamApplication_SALTPACK, keybase1.PerTeamKeyGeneration(4))
	require.Error(t, err)
	require.IsType(t, err, libkb.KeyMaskNotFoundError{})

	t.Logf("U0 adds U1 as a writer to the subteam")
	_, err = AddMember(context.TODO(), tcs[0].G, subteamName, fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	t.Logf("U1 succeeds in reading the SALTPACK RKM at gen=4")
	subteamFull, err := GetForTestByID(context.TODO(), tcs[1].G, subteamID)
	require.NoError(t, err)
	_, err = ApplicationKeyAtGeneration(mctx, subteamFull, keybase1.TeamApplication_SALTPACK, keybase1.PerTeamKeyGeneration(4))
	require.NoError(t, err)
}

func TestLeaveSubteamWithImplicitAdminship(t *testing.T) {
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleAdmin(context.TODO(), tc.G, name, otherA.Username); err != nil {
		t.Fatal(err)
	}
	if err := SetRoleAdmin(context.TODO(), tc.G, name, otherB.Username); err != nil {
		t.Fatal(err)
	}
	teamNameParsed, err := keybase1.TeamNameFromString(name)
	if err != nil {
		t.Fatal(err)
	}

	subteamNameParsed, _ := createSubteam(&tc, teamNameParsed, "subteam")
	subteamName := subteamNameParsed.String()

	if err := SetRoleAdmin(context.TODO(), tc.G, subteamName, otherA.Username); err != nil {
		t.Fatal(err)
	}
	if err := SetRoleAdmin(context.TODO(), tc.G, subteamName, otherB.Username); err != nil {
		t.Fatal(err)
	}

	err = tc.Logout()
	require.NoError(t, err)

	if err := otherA.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, subteamName, false); err != nil {
		t.Fatal(err)
	}
	err = tc.Logout()
	require.NoError(t, err)

	if err := otherB.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, subteamName, false); err != nil {
		t.Fatal(err)
	}
	err = tc.Logout()
	require.NoError(t, err)

	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	team, err := GetForTestByStringName(context.TODO(), tc.G, subteamName)
	if err != nil {
		t.Fatal(err)
	}
	if team.IsMember(context.TODO(), otherA.GetUserVersion()) {
		t.Fatal("Admin user is still member after leave.")
	}
	if team.IsMember(context.TODO(), otherB.GetUserVersion()) {
		t.Fatal("Writer user is still member after leave.")
	}

	// Try to leave the team again.
	// They are now an implicit admin and not an explicit member.
	// So this should fail, but with a reasonable error.
	t.Logf("try to leave again")
	err = tc.Logout()
	require.NoError(t, err)
	err = otherA.Login(tc.G)
	require.NoError(t, err)
	err = Leave(context.TODO(), tc.G, subteamName, false)
	require.Error(t, err)
	require.IsType(t, &ImplicitAdminCannotLeaveError{}, err, "wrong error type")
}

// See CORE-6473
func TestOnlyOwnerLeaveThenUpgradeFriend(t *testing.T) {

	tc, _, otherA, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, otherA.Username); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, name, false); err == nil {
		t.Fatal("expected an error when only owner is leaving")
	}
	if err := SetRoleOwner(context.TODO(), tc.G, name, otherA.Username); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, name, false); err != nil {
		t.Fatal(err)
	}
}

func testLeaveAsRole(t *testing.T, role keybase1.TeamRole) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates fennel_network")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to the root")
	var botSettings *keybase1.TeamBotSettings
	if role.IsRestrictedBot() {
		botSettings = &keybase1.TeamBotSettings{}
	}
	_, err := AddMember(context.Background(), tcs[0].G, teamName.String(), fus[1].Username, role, botSettings)
	require.NoError(t, err)

	t.Logf("U1 leaves the team")
	err = Leave(context.Background(), tcs[1].G, teamName.String(), false)
	require.NoError(t, err)

	t.Logf("U0 loads the team")
	require.NoError(t, err, "loading the team")
	_, err = Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	t.Logf("U0 loads the team from scratch")
	_, err = Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{
		ID:              teamID,
		ForceFullReload: true,
		ForceRepoll:     true,
	})
	require.NoError(t, err, "loading the team FROM SCRATCH")
}

func TestLeaveAsReader(t *testing.T) {
	testLeaveAsRole(t, keybase1.TeamRole_READER)
}

func TestLeaveAsBot(t *testing.T) {
	testLeaveAsRole(t, keybase1.TeamRole_BOT)
}

func TestLeaveAsRestrictedBot(t *testing.T) {
	testLeaveAsRole(t, keybase1.TeamRole_RESTRICTEDBOT)
}

func TestMemberAddResolveCache(t *testing.T) {
	tc, _, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)

	// load user so it is fully cached
	_, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, other.Username))
	if err != nil {
		t.Fatal(err)
	}

	// clear the memory cache so it will come from disk
	tc.G.Resolver.EnableCaching(libkb.NewMetaContextForTest(tc))

	// add the member
	res, err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.User.Username != other.Username {
		t.Errorf("AddMember result username %q does not match arg username %q", res.User.Username, other.Username)
	}

	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)
}

func assertRole(tc libkb.TestContext, name, username string, expected keybase1.TeamRole) {
	role, err := MemberRole(context.TODO(), tc.G, name, username)
	if err != nil {
		if err == errInviteRequired && expected == keybase1.TeamRole_NONE {
			return
		}
		require.Fail(tc.T, err.Error())
	}
	if role != expected {
		require.Fail(tc.T, fmt.Sprintf("role: %s, expected %s", role, expected))
	}
}

func assertRole2(tc libkb.TestContext, teamID keybase1.TeamID, username string, expected keybase1.TeamRole) {
	team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		ID:          teamID,
		Public:      teamID.IsPublic(),
		ForceRepoll: true,
	})
	require.NoError(tc.T, err)

	uv, err := loadUserVersionByUsername(context.TODO(), tc.G, username, true)
	require.NoError(tc.T, err)

	role, err := team.MemberRole(context.TODO(), uv)
	require.NoError(tc.T, err)

	if role != expected {
		tc.T.Fatalf("role: %s, expected %s", role, expected)
	}
}

func assertInvite(tc libkb.TestContext, name, username, typ string, role keybase1.TeamRole) {
	tc.T.Logf("looking for invite for %s/%s w/ role %s in team %s", username, typ, role, name)
	iname := keybase1.TeamInviteName(username)
	itype, err := TeamInviteTypeFromString(tc.MetaContext(), typ)
	require.NoError(tc.T, err)
	invite, err := memberInvite(context.TODO(), tc.G, name, iname, itype)
	require.NoError(tc.T, err)
	require.NotNil(tc.T, invite)
	require.Equal(tc.T, role, invite.Role)
}

func assertNoInvite(tc libkb.TestContext, name, username, typ string) {
	iname := keybase1.TeamInviteName(username)
	itype, err := TeamInviteTypeFromString(tc.MetaContext(), typ)
	if err != nil {
		tc.T.Fatal(err)
	}
	invite, err := memberInvite(context.TODO(), tc.G, name, iname, itype)
	if err == nil {
		tc.T.Fatal("expected not found err, got nil")
	}
	if _, ok := err.(libkb.NotFoundError); !ok {
		tc.T.Fatalf("expected libkb.NotFoundError, got %T", err)
	}
	if invite != nil {
		tc.T.Fatal("invite found")
	}

}
func TestImplicitAdminsKeyedForSubteam(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	t.Logf("U0 creates a root team")
	parentName, _ := createTeam2(*tcs[0])

	t.Logf("U0 creates a subteam")
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "sub", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	t.Logf("U1 and U2 can't load the subteam")
	_, err = tcs[1].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.Error(t, err, "U1 should not be able to load subteam without implicit admin status")
	_, err = tcs[2].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.Error(t, err, "U2 isn't in the subteam at all yet, shouldn't be able to load")

	t.Logf("U0 adds U1 as an admin in the root team")
	_, err = AddMember(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	t.Logf("now U1 can load the subteam, but not U2")
	_, err = tcs[1].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.NoError(t, err, "U1 should able to load subteam with implicit admin status")
	_, err = tcs[2].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.Error(t, err, "U2 still isn't in the subteam at yet, shouldn't be able to load")

	t.Logf("U1 can add U2 to the subteam")
	_, err = AddMember(context.TODO(), tcs[1].G, parentName.String(), fus[2].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	t.Logf("now U2 can load the subteam")
	_, err = tcs[1].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.NoError(t, err, "now U2 is a member of the subteam and should be able to read it")
}

func TestImplicitAdminsKeyedForSubteamAfterUpgrade(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	parentName, _ := createTeam2(*tcs[0])
	t.Logf("U0 created a root team %q", parentName)

	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "sub", parentName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	t.Logf("U0 created a subteam %q", subteamID)

	_, err = AddMember(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// U1 can't read the subteam (yet).
	_, err = tcs[1].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.Error(t, err)

	// Set U1 to be an admin of root team.
	err = SetRoleAdmin(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username)
	require.NoError(t, err)

	// U1 should be able to read subteam now.
	_, err = tcs[1].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.NoError(t, err)
}

// add user without keys to a team, should create invite link.
// remove that user from the team should cancel the invite.
func TestMemberCancelInviteNoKeys(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	username := "t_ellen"
	_, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}

	assertInvite(tc, name, "561247eb1cc3b0f5dc9d9bf299da5e19%0", "keybase", keybase1.TeamRole_READER)
	assertRole(tc, name, username, keybase1.TeamRole_NONE)

	if err := RemoveMember(context.TODO(), tc.G, name, username); err != nil {
		t.Fatal(err)
	}

	assertNoInvite(tc, name, "561247eb1cc3b0f5dc9d9bf299da5e19%0", "keybase")
	assertRole(tc, name, username, keybase1.TeamRole_NONE)
}

func TestMemberCancelInviteSocial(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	tc.G.SetProofServices(externals.NewProofServices(tc.G))

	username := "not_on_kb_yet@twitter"
	_, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER, nil)
	if err != nil {
		t.Fatal(err)
	}
	assertInvite(tc, name, "not_on_kb_yet", "twitter", keybase1.TeamRole_READER)

	if err := RemoveMember(context.TODO(), tc.G, name, username); err != nil {
		t.Fatal(err)
	}

	assertNoInvite(tc, name, "not_on_kb_yet", "twitter")
}

func TestMemberCancelInviteEmail(t *testing.T) {
	tc, _, name, teamID := memberSetupWithID(t)
	defer tc.Cleanup()

	tc.G.SetProofServices(externals.NewProofServices(tc.G))

	address := "noone@keybase.io"

	if err := InviteEmailPhoneMember(context.TODO(), tc.G, teamID, address, "email", keybase1.TeamRole_READER); err != nil {
		t.Fatal(err)
	}
	assertInvite(tc, name, address, "email", keybase1.TeamRole_READER)

	require.NoError(t, CancelEmailInvite(context.TODO(), tc.G, teamID, address))

	assertNoInvite(tc, name, address, "email")

	// check error type for an email address with no invite
	err := CancelEmailInvite(context.TODO(), tc.G, teamID, "nope@keybase.io")
	if err == nil {
		t.Fatal("expected error canceling email invite for unknown email address")
	}
	require.IsType(t, err, &MemberNotFoundInChainError{})

	// check error type for unknown team
	err = CancelEmailInvite(context.TODO(), tc.G, "notateam", address)
	if err == nil {
		t.Fatal("expected error canceling email invite for unknown team")
	}
	require.EqualError(t, err, "team load arg has invalid ID: \"notateam\"")
}

// Test two users racing to post chain links to the same team.
// In this case, adding different users to the team.
// The expected behavior is that they both succeed.
// A rotation is also thrown in some time.
func TestMemberAddRace(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, rootID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1")
	_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err, "add member")

	// add or remove a user from the team
	mod := func(userIndexOperator, userIndexTarget int, add bool) <-chan error {
		errCh := make(chan error)
		go func() {
			ctx := context.Background()
			ctx = libkb.WithLogTag(ctx, "TEST")
			var err error
			desc := "removes"
			if add {
				desc = "adds"
			}
			t.Logf("U%v %v U%v", userIndexOperator, desc, userIndexTarget)
			if add {
				_, err = AddMember(ctx,
					tcs[userIndexOperator].G, rootName.String(), fus[userIndexTarget].Username, keybase1.TeamRole_READER, nil)
			} else {
				err = RemoveMember(ctx,
					tcs[userIndexOperator].G, rootName.String(), fus[userIndexTarget].Username)
			}
			errCh <- err
		}()
		return errCh
	}

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
		doRotate := i%2 == 1

		t.Logf("parallel start")

		var errCh3 <-chan error
		if doRotate {
			errCh3 = rotate(0)
		}
		errCh1 := mod(0, 2, true)
		errCh2 := mod(1, 3, true)
		assertNoErr(errCh1, "round %v", i)
		assertNoErr(errCh2, "round %v", i)
		if doRotate {
			assertNoErr(errCh3, "round %v", i)
		}

		t.Logf("parallel end")

		assertNoErr(mod(0, 2, false))
		assertNoErr(mod(1, 3, false))
	}
}

// Test two users racing to post chain links to the same team.
// In this case, adding the same user to the team.
// The expected behavior is that one will win and one will fail with a nice error.
func TestMemberAddRaceConflict(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, _ := createTeam2(*tcs[0])

	t.Logf("U0 adds U1")
	_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err, "add member")

	// add or remove a user from the team
	mod := func(userIndexOperator, userIndexTarget int, add bool) <-chan error {
		errCh := make(chan error)
		go func() {
			ctx := context.Background()
			ctx = libkb.WithLogTag(ctx, "TEST")
			var err error
			desc := "removes"
			if add {
				desc = "adds"
			}
			t.Logf("U%v %v U%v", userIndexOperator, desc, userIndexTarget)
			if add {
				_, err = AddMember(ctx,
					tcs[userIndexOperator].G, rootName.String(), fus[userIndexTarget].Username, keybase1.TeamRole_READER, nil)
			} else {
				err = RemoveMember(ctx,
					tcs[userIndexOperator].G, rootName.String(), fus[userIndexTarget].Username)
			}
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

	// Exactly one error comes from the list of channels
	assertOneErr := func(errChs []<-chan error, msgAndArgs ...interface{}) (retErr error) {
		for i, errCh := range errChs {
			select {
			case err := <-errCh:
				if retErr == nil {
					retErr = err
				} else {
					require.NoError(t, err, msgAndArgs...)
				}
			case <-time.After(20 * time.Second):
				require.FailNow(t, "timeout waiting for return channel: %v", i)
			}
		}
		return retErr
	}

	for i := 0; i < 5; i++ {
		t.Logf("round %v", i)

		t.Logf("parallel start")

		errCh1 := mod(0, 2, true)
		errCh2 := mod(1, 2, true)
		err := assertOneErr([](<-chan error){errCh1, errCh2})
		require.Errorf(t, err, "round %v", i)
		require.IsType(t, libkb.ExistsError{}, err, "user should already be in team (round %v)", i)

		t.Logf("parallel end")

		assertNoErr(mod(0, 2, false))
	}
}

// Add user without puk to a team, then change their role.
func TestMemberInviteChangeRole(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	username := "t_alice"
	uid := keybase1.UID("295a7eea607af32040647123732bc819")
	role := keybase1.TeamRole_READER

	res, err := AddMember(context.TODO(), tc.G, name, username, role, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Invited {
		t.Fatal("res.Invited should be set")
	}

	fqUID := string(uid) + "%1"
	assertInvite(tc, name, fqUID, "keybase", role)

	if err := EditMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_ADMIN, nil); err != nil {
		t.Fatal(err)
	}
	assertInvite(tc, name, fqUID, "keybase", keybase1.TeamRole_ADMIN)
}

// Add user without puk to a team, then change the invite role to owner,
// which should now work.
func TestMemberInviteChangeRoleOwner(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	username := "t_alice"
	uid := keybase1.UID("295a7eea607af32040647123732bc819")
	role := keybase1.TeamRole_READER

	res, err := AddMember(context.TODO(), tc.G, name, username, role, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Invited {
		t.Fatal("res.Invited should be set")
	}

	fqUID := string(uid) + "%1"
	assertInvite(tc, name, fqUID, "keybase", role)

	if err := EditMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_OWNER, nil); err != nil {
		t.Fatal(err)
	}
	assertInvite(tc, name, fqUID, "keybase", keybase1.TeamRole_OWNER)
}

func TestFollowResetAdd(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	alice, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	teamName, teamID := createTeam2(tc)
	team := teamName.String()
	t.Logf("Created team %q", team)
	err = tc.Logout()
	require.NoError(t, err)

	bob, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	charlie, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	// alice tracks bob and charlie
	err = alice.Login(tc.G)
	require.NoError(t, err)
	_, err = kbtest.RunTrack(tc, alice, bob.Username)
	require.NoError(t, err)
	_, err = kbtest.RunTrack(tc, alice, charlie.Username)
	require.NoError(t, err)

	// alice lets charlie into the team
	_, err = AddMember(context.TODO(), tc.G, team, charlie.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	// bob and charlie reset
	err = tc.Logout()
	require.NoError(t, err)
	err = bob.Login(tc.G)
	require.NoError(t, err)
	kbtest.ResetAccount(tc, bob)
	err = tc.Logout()
	require.NoError(t, err)

	err = charlie.Login(tc.G)
	require.NoError(t, err)
	kbtest.ResetAccount(tc, charlie)
	err = tc.Logout()
	require.NoError(t, err)

	// alice fails to invite bob into the team since her tracking statement of him is broken
	err = alice.Login(tc.G)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, team, bob.Username, keybase1.TeamRole_ADMIN, nil)
	require.Error(t, err)
	require.True(t, libkb.IsIdentifyProofError(err))

	// AddMembers also fails
	added, notAdded, err := AddMembers(context.TODO(), tc.G, teamID, []keybase1.UserRolePair{{Assertion: bob.Username, Role: keybase1.TeamRole_ADMIN}}, nil /* emailInviteMsg */)
	require.Error(t, err)
	amerr, ok := err.(AddMembersError)
	require.True(t, ok)
	require.True(t, libkb.IsIdentifyProofError(amerr.Err))
	require.Nil(t, added)
	require.Nil(t, notAdded)

	// alice succeeds in removing charlie from the team, since her broken tracking statement
	// is ignored for a team removal.
	err = RemoveMember(context.TODO(), tc.G, team, charlie.Username)
	require.NoError(t, err)
}

func TestAddMemberWithRestrictiveContactSettings(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	alice, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	teamName, _ := createTeam2(tc)
	team := teamName.String()
	t.Logf("Created team %q", team)
	err = tc.Logout()
	require.NoError(t, err)

	bob, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	charlie, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	// charlie sets contact settings
	kbtest.SetContactSettings(tc, charlie, keybase1.ContactSettings{
		Enabled:              true,
		AllowFolloweeDegrees: 1,
	})

	// alice can add bob
	err = tc.Logout()
	require.NoError(t, err)
	err = alice.Login(tc.G)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, team, bob.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// alice can't add charlie
	_, err = AddMember(context.TODO(), tc.G, team, charlie.Username, keybase1.TeamRole_WRITER, nil)
	require.Error(t, err)
	usernames := err.(libkb.TeamContactSettingsBlockError).BlockedUsernames()
	require.Equal(t, usernames[0].String(), charlie.Username)

	// charlie tracks alice
	err = tc.Logout()
	require.NoError(t, err)
	err = charlie.Login(tc.G)
	require.NoError(t, err)

	_, err = kbtest.RunTrack(tc, charlie, alice.Username)
	require.NoError(t, err)

	// alice can add charlie
	err = tc.Logout()
	require.NoError(t, err)
	err = alice.Login(tc.G)
	require.NoError(t, err)

	_, err = AddMember(context.TODO(), tc.G, team, charlie.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
}

func TestAddMembersWithRestrictiveContactSettings(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	alice, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	teamName, teamID := createTeam2(tc)
	team := teamName.String()
	t.Logf("Created team %q", team)
	err = tc.Logout()
	require.NoError(t, err)

	bob, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	err = tc.Logout()
	require.NoError(t, err)

	charlie, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	// charlie sets contact settings
	kbtest.SetContactSettings(tc, charlie, keybase1.ContactSettings{
		Enabled:              true,
		AllowFolloweeDegrees: 1,
	})

	// alice can add bob but not charlie
	err = tc.Logout()
	require.NoError(t, err)
	err = alice.Login(tc.G)
	require.NoError(t, err)
	users := []keybase1.UserRolePair{
		{Assertion: bob.Username, Role: keybase1.TeamRole_WRITER},
		{Assertion: charlie.Username, Role: keybase1.TeamRole_WRITER},
	}
	added, notAdded, err := AddMembers(context.TODO(), tc.G, teamID, users, nil /* emailInviteMsg */)
	require.NoError(t, err)
	require.Equal(t, 1, len(added))
	require.Equal(t, libkb.NewNormalizedUsername(bob.Username), added[0].Username)
	require.Equal(t, 1, len(notAdded))
	require.Equal(t, libkb.NewNormalizedUsername(charlie.Username).String(), notAdded[0].Username)
}

func TestAddMembersWithRestrictiveContactSettingsFailIfNoneAdded(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	alice, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	teamName, teamID := createTeam2(tc)
	team := teamName.String()
	t.Logf("Created team %q", team)
	err = tc.Logout()
	require.NoError(t, err)

	bob, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	kbtest.SetContactSettings(tc, bob, keybase1.ContactSettings{
		Enabled:              true,
		AllowFolloweeDegrees: 1,
	})
	err = tc.Logout()
	require.NoError(t, err)

	charlie, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	kbtest.SetContactSettings(tc, charlie, keybase1.ContactSettings{
		Enabled:              true,
		AllowFolloweeDegrees: 1,
	})
	err = tc.Logout()
	require.NoError(t, err)

	expectedFailedUsernames := map[libkb.NormalizedUsername]bool{
		libkb.NewNormalizedUsername(bob.Username):     true,
		libkb.NewNormalizedUsername(charlie.Username): true,
	}

	// alice can't add bob or charlie
	err = alice.Login(tc.G)
	require.NoError(t, err)
	users := []keybase1.UserRolePair{
		{Assertion: bob.Username, Role: keybase1.TeamRole_WRITER},
		{Assertion: charlie.Username, Role: keybase1.TeamRole_WRITER},
	}
	added, notAdded, err := AddMembers(context.TODO(), tc.G, teamID, users, nil /* emailInviteMsg */)
	require.Error(t, err)
	require.IsType(t, err, libkb.TeamContactSettingsBlockError{})
	usernames := err.(libkb.TeamContactSettingsBlockError).BlockedUsernames()
	require.Equal(t, 2, len(usernames))
	for _, username := range usernames {
		_, ok := expectedFailedUsernames[username]
		require.True(t, ok)
	}
	require.IsType(t, err, libkb.TeamContactSettingsBlockError{})
	require.Nil(t, added)
	require.Nil(t, notAdded)
}

func TestGetUntrustedTeamInfo(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 7)
	defer cleanup()

	// prepare a mock team
	owner := 0
	publicAdmin := 1
	privateAdmin := 2
	publicReader := 3
	privateReader := 4
	restrictedBot := 5
	nonMember := 6

	fullNames := make(map[int]string)
	fullNames[publicAdmin] = "TheMostAmazing Admin"
	fullNames[publicReader] = "TheEvenBetter Reader"

	setFullName := func(target int) {
		eng := engine.NewProfileEdit(tcs[target].G, keybase1.ProfileEditArg{Location: "", FullName: fullNames[target], Bio: ""})
		err := eng.Run(tcs[target].MetaContext())
		require.NoError(t, err)
	}
	setFullName(publicAdmin)
	setFullName(publicReader)

	teamName, teamID := createTeam2(*tcs[owner])
	team := teamName.String()
	added, notAdded, err := AddMembers(context.TODO(), tcs[owner].G, teamID, []keybase1.UserRolePair{
		{Assertion: fus[publicAdmin].Username, Role: keybase1.TeamRole_ADMIN},
		{Assertion: fus[privateAdmin].Username, Role: keybase1.TeamRole_ADMIN},
		{Assertion: fus[publicReader].Username, Role: keybase1.TeamRole_READER},
		{Assertion: fus[privateReader].Username, Role: keybase1.TeamRole_READER},
		{Assertion: fus[restrictedBot].Username, Role: keybase1.TeamRole_RESTRICTEDBOT, BotSettings: &keybase1.TeamBotSettings{Cmds: false, Mentions: true}},
	}, nil)
	require.NoError(t, err)
	require.Len(t, notAdded, 0)
	require.Len(t, added, 5)
	t.Logf("Created team %q", team)

	// showcase the team, make it open and set some public members
	isShowcased := true
	description := "best team ever"

	err = ChangeTeamSettingsByID(context.TODO(), tcs[owner].G, teamID, keybase1.TeamSettings{Open: true, JoinAs: keybase1.TeamRole_WRITER})
	require.NoError(t, err)

	err = SetTeamShowcase(context.TODO(), tcs[owner].G, teamID, &isShowcased, &description, nil)
	require.NoError(t, err)

	err = SetTeamMemberShowcase(context.TODO(), tcs[publicAdmin].G, teamID, true)
	require.NoError(t, err)

	err = SetTeamMemberShowcase(context.TODO(), tcs[publicReader].G, teamID, true)
	require.NoError(t, err)

	// load the team as a non member
	ret, err := GetUntrustedTeamInfo(tcs[nonMember].MetaContext(), teamName)
	require.NoError(t, err)
	// check the information matches what we expect
	require.Equal(t, teamName, ret.Name)
	require.Equal(t, description, ret.Description)
	require.Equal(t, false, ret.InTeam)
	require.Equal(t, true, ret.Open)
	require.Equal(t, 5, ret.NumMembers)
	require.Len(t, ret.PublicAdmins, 1)
	require.Equal(t, fus[publicAdmin].Username, ret.PublicAdmins[0])
	require.Len(t, ret.PublicMembers, 2)

	checkPublicMember := func(target int, role keybase1.TeamRole) {
		found := false
		for _, pm := range ret.PublicMembers {
			if pm.Uid != fus[target].GetUID() {
				continue
			}
			found = true
			require.Equal(t, fus[target].User.GetUID(), pm.Uid)
			require.Equal(t, fus[target].Username, pm.Username)
			require.Equal(t, keybase1.FullName(fullNames[target]), pm.FullName)
			require.Equal(t, role, pm.Role)
		}
		assert.True(t, found, "target %v not found: %v", target, fus[target].Username)
	}
	checkPublicMember(publicAdmin, keybase1.TeamRole_ADMIN)
	checkPublicMember(publicReader, keybase1.TeamRole_READER)
}

func TestMembersDetailsHasCorrectJoinTimes(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	const (
		alice   = 0
		bob     = 1
		charlie = 2
	)

	var team string

	// setup some auxiliary functions
	type expectedMemberDetails struct {
		Username       string
		Role           keybase1.TeamRole
		JoinLowerBound keybase1.Time
		JoinUpperBound keybase1.Time
	}

	findUserDetails := func(res []keybase1.TeamMemberDetails, username string, role keybase1.TeamRole) keybase1.TeamMemberDetails {
		for _, detail := range res {
			if detail.Username == username {
				return detail
			}
		}
		t.Fatalf("User %v with role %v not found", username, role)
		return keybase1.TeamMemberDetails{}
	}

	checkDetails := func(tc *libkb.TestContext, details []expectedMemberDetails, expNumMembers int) {
		loadedTeam, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
			Name:        team,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		res, err := MembersDetails(context.TODO(), tc.G, loadedTeam)
		require.NoError(t, err)

		numMembers := len(res)
		require.Equal(t, expNumMembers, numMembers)

		for _, expUserDetails := range details {
			userDetails := findUserDetails(res, expUserDetails.Username, expUserDetails.Role)
			assert.True(t, userDetails.JoinTime.After(expUserDetails.JoinLowerBound), "user %v joined at time %v but lower bound was %v", expUserDetails.Username, userDetails.JoinTime, expUserDetails.JoinLowerBound)
			assert.True(t, userDetails.JoinTime.Before(expUserDetails.JoinUpperBound), "user %v joined at time %v but upper bound was %v", expUserDetails.Username, userDetails.JoinTime, expUserDetails.JoinUpperBound)
		}
	}

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tcs[alice].G.SetClock(fakeClock)

	// start the test
	startTime := keybase1.ToTime(fakeClock.Now())
	// do small advances not to trigger the server into rejecting our updates (there is a 1 hour tolerance).
	fakeClock.Advance(1 * time.Minute)

	// alice makes a team
	teamName, _ := createTeam2(*tcs[alice])
	team = teamName.String()
	t.Logf("Created team %q", team)

	fakeClock.Advance(1 * time.Minute)
	teamCreateTime := keybase1.ToTime(fakeClock.Now())
	fakeClock.Advance(1 * time.Minute)

	checkDetails(tcs[alice], []expectedMemberDetails{
		{Username: fus[alice].Username, Role: keybase1.TeamRole_OWNER, JoinLowerBound: startTime, JoinUpperBound: teamCreateTime},
	}, 1)

	_, err := AddMember(context.TODO(), tcs[alice].G, team, fus[bob].Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	fakeClock.Advance(1 * time.Minute)
	firstAddBoBTime := keybase1.ToTime(fakeClock.Now())
	fakeClock.Advance(1 * time.Minute)

	checkDetails(tcs[alice], []expectedMemberDetails{
		{Username: fus[alice].Username, Role: keybase1.TeamRole_OWNER, JoinLowerBound: startTime, JoinUpperBound: teamCreateTime},
		{Username: fus[bob].Username, Role: keybase1.TeamRole_READER, JoinLowerBound: teamCreateTime, JoinUpperBound: firstAddBoBTime},
	}, 2)

	checkDetails(tcs[bob], []expectedMemberDetails{
		{Username: fus[alice].Username, Role: keybase1.TeamRole_OWNER, JoinLowerBound: startTime, JoinUpperBound: teamCreateTime},
		{Username: fus[bob].Username, Role: keybase1.TeamRole_READER, JoinLowerBound: teamCreateTime, JoinUpperBound: firstAddBoBTime},
	}, 2)

	err = RemoveMember(context.TODO(), tcs[alice].G, team, fus[bob].Username)
	require.NoError(t, err)

	fakeClock.Advance(1 * time.Minute)
	removeBoBTime := keybase1.ToTime(fakeClock.Now())
	fakeClock.Advance(1 * time.Minute)

	checkDetails(tcs[alice], []expectedMemberDetails{
		{Username: fus[alice].Username, Role: keybase1.TeamRole_OWNER, JoinLowerBound: startTime, JoinUpperBound: teamCreateTime},
	}, 1)

	_, err = AddMember(context.TODO(), tcs[alice].G, team, fus[charlie].Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	fakeClock.Advance(1 * time.Minute)
	addCharlieTime := keybase1.ToTime(fakeClock.Now())
	fakeClock.Advance(1 * time.Minute)

	checkDetails(tcs[alice], []expectedMemberDetails{
		{Username: fus[alice].Username, Role: keybase1.TeamRole_OWNER, JoinLowerBound: startTime, JoinUpperBound: teamCreateTime},
		{Username: fus[charlie].Username, Role: keybase1.TeamRole_READER, JoinLowerBound: removeBoBTime, JoinUpperBound: addCharlieTime},
	}, 2)

	_, err = AddMember(context.TODO(), tcs[alice].G, team, fus[bob].Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	fakeClock.Advance(1 * time.Minute)
	secondAddBoBTime := keybase1.ToTime(fakeClock.Now())
	fakeClock.Advance(1 * time.Minute)

	checkDetails(tcs[alice], []expectedMemberDetails{
		{Username: fus[alice].Username, Role: keybase1.TeamRole_OWNER, JoinLowerBound: startTime, JoinUpperBound: teamCreateTime},
		{Username: fus[charlie].Username, Role: keybase1.TeamRole_READER, JoinLowerBound: removeBoBTime, JoinUpperBound: addCharlieTime},
		// ensure the bob's join time is from the second time he joined the team, not the first!
		{Username: fus[bob].Username, Role: keybase1.TeamRole_READER, JoinLowerBound: addCharlieTime, JoinUpperBound: secondAddBoBTime},
	}, 3)

	err = EditMember(context.TODO(), tcs[alice].G, team, fus[charlie].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	checkDetails(tcs[alice], []expectedMemberDetails{
		{Username: fus[alice].Username, Role: keybase1.TeamRole_OWNER, JoinLowerBound: startTime, JoinUpperBound: teamCreateTime},
		// ensure the charlie's join time is not affected by his role change
		{Username: fus[charlie].Username, Role: keybase1.TeamRole_ADMIN, JoinLowerBound: removeBoBTime, JoinUpperBound: addCharlieTime},
		{Username: fus[bob].Username, Role: keybase1.TeamRole_READER, JoinLowerBound: addCharlieTime, JoinUpperBound: secondAddBoBTime},
	}, 3)

}

func TestTeamPlayerNoRoleChange(t *testing.T) {
	// Try to change_membership on user that is already in the team but do not
	// upgrade role.

	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	testUV := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_alice_t"), EldestSeqno: 1}

	teamSectionCM := makeTestSCTeamSection(team)
	teamSectionCM.Members = &SCTeamMembers{
		Writers: &[]SCTeamMember{SCTeamMember(testUV)},
	}
	state, err := appendSigToState(t, team, nil /* state */, libkb.LinkTypeChangeMembership,
		teamSectionCM, me, nil /* merkleRoot */)
	require.NoError(t, err)

	userLog := state.inner.UserLog[testUV]
	require.Len(t, userLog, 1)
	require.Equal(t, keybase1.TeamRole_WRITER, userLog[0].Role)
	require.EqualValues(t, 2, userLog[0].SigMeta.SigChainLocation.Seqno)

	// Append the same link again: "change" Writer testUV to Writer.
	state, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
		teamSectionCM, me, nil /* merkleRoot */)
	require.NoError(t, err)

	// That adds a new UserLog point with proper SigChainLocation, and the same
	// role (writer).
	userLog = state.inner.UserLog[testUV]
	require.Len(t, userLog, 2)
	for i, lp := range userLog {
		require.Equal(t, keybase1.TeamRole_WRITER, lp.Role)
		require.EqualValues(t, 2+i, lp.SigMeta.SigChainLocation.Seqno)
	}
}

var rmMaker = func(assertion string) keybase1.TeamMemberToRemove {
	return keybase1.NewTeamMemberToRemoveWithAssertion(keybase1.AssertionTeamMemberToRemove{
		Assertion:         assertion,
		RemoveFromSubtree: false,
	})
}
var rmRecursiveMaker = func(assertion string) keybase1.TeamMemberToRemove {
	return keybase1.NewTeamMemberToRemoveWithAssertion(keybase1.AssertionTeamMemberToRemove{
		Assertion:         assertion,
		RemoveFromSubtree: true,
	})
}

func TestRemoveMembersHappy(t *testing.T) {
	tc, _, alice, bob, name, teamID := memberSetupMultipleWithTeamID(t)
	defer tc.Cleanup()

	if err := SetRoleReader(context.TODO(), tc.G, name.String(), alice.Username); err != nil {
		t.Fatal(err)
	}

	res, err := RemoveMembers(context.TODO(), tc.G, teamID, []keybase1.TeamMemberToRemove{rmMaker(alice.Username)}, false)
	require.NoError(t, err)
	require.Len(t, res.Failures, 0)
	assertRole(tc, name.String(), alice.Username, keybase1.TeamRole_NONE)

	if err := SetRoleReader(context.TODO(), tc.G, name.String(), alice.Username); err != nil {
		t.Fatal(err)
	}
	if err := SetRoleReader(context.TODO(), tc.G, name.String(), bob.Username); err != nil {
		t.Fatal(err)
	}
	twitterUser := "not_on_kb_yet@twitter"
	tAlice := "t_alice"
	_, err = AddMember(context.TODO(), tc.G, name.String(), twitterUser, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err, "add a social")
	_, err = AddMember(context.TODO(), tc.G, name.String(), tAlice, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err, "add a pukless")
	assertRole(tc, name.String(), alice.Username, keybase1.TeamRole_READER)
	assertRole(tc, name.String(), bob.Username, keybase1.TeamRole_READER)
	assertInvite(tc, name.String(), "not_on_kb_yet", "twitter", keybase1.TeamRole_WRITER)
	tAliceFQUID := "295a7eea607af32040647123732bc819%1"
	assertInvite(tc, name.String(), tAliceFQUID, "keybase", keybase1.TeamRole_WRITER)
	res, err = RemoveMembers(context.TODO(), tc.G, teamID, []keybase1.TeamMemberToRemove{
		rmMaker(alice.Username), rmRecursiveMaker(bob.Username),
		rmRecursiveMaker(twitterUser), rmMaker(tAlice),
	}, false)
	require.NoError(t, err)
	require.Len(t, res.Failures, 0)
	assertRole(tc, name.String(), alice.Username, keybase1.TeamRole_NONE)
	assertRole(tc, name.String(), bob.Username, keybase1.TeamRole_NONE)
	assertRole(tc, name.String(), twitterUser, keybase1.TeamRole_NONE)
	assertRole(tc, name.String(), tAlice, keybase1.TeamRole_NONE)
}

func TestRemoveMembersErrorsBasic(t *testing.T) {
	tc, _, _, _, _, teamID := memberSetupMultipleWithTeamID(t)
	defer tc.Cleanup()

	twitterUser := "not_on_kb_yet@twitter"
	tAlice := "t_alice"
	res, err := RemoveMembers(context.TODO(), tc.G, teamID, []keybase1.TeamMemberToRemove{
		rmMaker(tAlice),
		rmMaker(twitterUser),
	}, false)
	require.Error(t, err)
	require.Len(t, res.Failures, 2)
	require.NotNil(t, res.Failures[0].ErrorAtTarget)
	require.Contains(t, *res.Failures[0].ErrorAtTarget, "could not find team member in team")
	require.Nil(t, res.Failures[0].ErrorAtSubtree)
	require.NotNil(t, res.Failures[1].ErrorAtTarget)
	require.Contains(t, *res.Failures[1].ErrorAtTarget, "could not find team member in team")
	require.Nil(t, res.Failures[1].ErrorAtSubtree)
}

func TestRemoveMembersJustAfterUpgrade(t *testing.T) {
	ownerTC := SetupTest(t, "team", 1)
	defer ownerTC.Cleanup()
	aliceTC := SetupTest(t, "team", 1)
	defer aliceTC.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", ownerTC.G)
	require.NoError(t, err)

	alice, err := kbtest.CreateAndSignupFakeUser("team", aliceTC.G)
	require.NoError(t, err)

	name, teamID := createTeam2(ownerTC)
	t.Logf("Created team %q", name)

	t.Logf("Test that a just-upgraded admin can remove invited members (previously stubbed links)")
	if err := SetRoleReader(context.TODO(), ownerTC.G, name.String(), alice.Username); err != nil {
		t.Fatal(err)
	}
	redditUser := "new@reddit"
	_, err = AddMember(context.TODO(), ownerTC.G, name.String(), redditUser, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	_, err = Load(context.TODO(), aliceTC.G, keybase1.LoadTeamArg{
		Name:        name.String(),
		ForceRepoll: true,
	})
	require.NoError(t, err)

	t.Logf("set as admin")
	if err := SetRoleAdmin(context.TODO(), ownerTC.G, name.String(), alice.Username); err != nil {
		t.Fatal(err)
	}

	t.Logf("try to remove members")
	_, err = RemoveMembers(context.TODO(), aliceTC.G, teamID, []keybase1.TeamMemberToRemove{
		rmMaker(redditUser),
	}, false)
	require.NoError(t, err)
}

func TestRemoveMembersHappyTree(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	admin, err := kbtest.CreateAndSignupFakeUser("trm", tc.G)
	require.NoError(t, err)
	alice, err := kbtest.CreateAndSignupFakeUser("trm", tc.G)
	require.NoError(t, err)
	bob, err := kbtest.CreateAndSignupFakeUser("trm", tc.G)
	require.NoError(t, err)
	twitterUser := "not_on_kb_yet@twitter"
	redditUser := "hello@reddit"
	tAlice := "t_alice"

	parentTeamName, err := keybase1.TeamNameFromString(admin.Username + "T")
	require.NoError(t, err)
	_, err = CreateRootTeam(context.TODO(), tc.G, parentTeamName.String(), keybase1.TeamSettings{})
	require.NoError(t, err)
	subteamBasename := "bbb"
	_, err = CreateSubteam(context.TODO(), tc.G, subteamBasename, parentTeamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subteamName, err := parentTeamName.Append(subteamBasename)
	require.NoError(t, err)
	subsubteamBasename := "ccc"
	_, err = CreateSubteam(context.TODO(), tc.G, subsubteamBasename, subteamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subsubteamName, err := subteamName.Append(subsubteamBasename)
	require.NoError(t, err)
	subsubsubteamBasename := "ddd"
	_, err = CreateSubteam(context.TODO(), tc.G, subsubsubteamBasename, subsubteamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)
	subsubsubteamName, err := subsubteamName.Append(subsubsubteamBasename)
	require.NoError(t, err)

	_, err = AddMember(context.TODO(), tc.G, parentTeamName.String(), alice.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subteamName.String(), alice.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subteamName.String(), twitterUser, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subteamName.String(), redditUser, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subteamName.String(), tAlice, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subsubteamName.String(), alice.Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subsubteamName.String(), bob.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subsubteamName.String(), tAlice, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subsubsubteamName.String(), twitterUser, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	reddittype, err := TeamInviteTypeFromString(tc.MetaContext(), "reddit")
	require.NoError(t, err)
	redditInvite, err := memberInvite(context.TODO(), tc.G, subteamName.String(), "hello", reddittype)
	require.NoError(t, err)
	redditInviteID := redditInvite.Id

	subteam, err := GetForTestByStringName(context.TODO(), tc.G, subteamName.String())
	require.NoError(t, err)
	res, err := RemoveMembers(context.TODO(), tc.G, subteam.ID, []keybase1.TeamMemberToRemove{
		rmRecursiveMaker(alice.Username),
		rmRecursiveMaker(twitterUser),
		keybase1.NewTeamMemberToRemoveWithInviteid(keybase1.InviteTeamMemberToRemove{
			InviteID: redditInviteID,
		}),
		rmMaker(tAlice),
		rmRecursiveMaker("notinteam"),
	}, false)
	require.Error(t, err, "got error for the one not-in-team user")
	require.Len(t, res.Failures, 1)
	require.Equal(t, rmRecursiveMaker("notinteam"), res.Failures[0].TeamMember)
	require.NotNil(t, res.Failures[0].ErrorAtTarget)
	require.NotNil(t, res.Failures[0].ErrorAtSubtree)

	tAliceFQUID := "295a7eea607af32040647123732bc819%1"
	assertRole(tc, subteamName.String(), alice.Username, keybase1.TeamRole_NONE)
	assertNoInvite(tc, subteamName.String(), "not_on_kb_yet", "twitter")
	assertNoInvite(tc, subteamName.String(), "hello", "reddit")
	assertNoInvite(tc, subteamName.String(), tAliceFQUID, "keybase")
	assertRole(tc, subsubteamName.String(), alice.Username, keybase1.TeamRole_NONE)
	assertInvite(tc, subsubteamName.String(), tAliceFQUID, "keybase", keybase1.TeamRole_WRITER)
	assertNoInvite(tc, subsubteamName.String(), "not_on_kb_yet", "twitter")
	assertNoInvite(tc, subsubsubteamName.String(), "not_on_kb_yet", "twitter")

	t.Logf("test removing self")
	_, err = AddMember(context.TODO(), tc.G, subteamName.String(), admin.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	_, err = AddMember(context.TODO(), tc.G, subsubsubteamName.String(), admin.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)
	res, err = RemoveMembers(context.TODO(), tc.G, subteam.ID, []keybase1.TeamMemberToRemove{
		rmRecursiveMaker(admin.Username),
	}, false)
	require.NoError(t, err)
	require.Len(t, res.Failures, 0)
	assertRole(tc, subteamName.String(), admin.Username, keybase1.TeamRole_NONE)
	assertRole(tc, subsubsubteamName.String(), admin.Username, keybase1.TeamRole_NONE)
}

func TestFindAssertionsInTeamForInvites(t *testing.T) {
	tc, admin, teamName, teamID := memberSetupWithID(t)
	defer tc.Cleanup()

	_ = admin
	_ = teamName

	phone := kbtest.GenerateTestPhoneNumber()

	err := InviteEmailPhoneMember(context.TODO(), tc.G, teamID, phone, "phone", keybase1.TeamRole_READER)
	require.NoError(t, err)

	{
		assertions := []string{
			phone + "@phone",
		}
		ret, err := FindAssertionsInTeamNoResolve(tc.MetaContext(), teamID, assertions)
		require.NoError(t, err)
		require.Len(t, ret, 1)
		require.Equal(t, phone+"@phone", ret[0])
	}

	{
		phone2 := kbtest.GenerateTestPhoneNumber()
		assertions := []string{
			phone2 + "@phone",
			phone + "@phone",
		}
		ret, err := FindAssertionsInTeamNoResolve(tc.MetaContext(), teamID, assertions)
		require.NoError(t, err)
		require.Len(t, ret, 1)
		require.Equal(t, phone+"@phone", ret[0])
	}

	email := kbtest.GenerateRandomEmailAddress(t)
	err = InviteEmailPhoneMember(context.TODO(), tc.G, teamID, email.String(), "email", keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	{
		assertions := []string{
			fmt.Sprintf("[%s]@email", email),
		}
		ret, err := FindAssertionsInTeamNoResolve(tc.MetaContext(), teamID, assertions)
		require.NoError(t, err)
		require.Len(t, ret, 1)
		require.Equal(t, assertions[0], ret[0])
	}

	email2 := kbtest.GenerateRandomEmailAddress(t)
	err = InviteEmailPhoneMember(context.TODO(), tc.G, teamID, email2.String(), "email", keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	{
		var assertions []string
		assertions = append(assertions, fmt.Sprintf("[%s]@email", email2))
		for i := 0; i < 5; i++ {
			assertions = append(assertions, fmt.Sprintf("[%s]@email", kbtest.GenerateRandomEmailAddress(t)))
		}
		assertions = append(assertions, fmt.Sprintf("[%s]@email", email))
		ret, err := FindAssertionsInTeamNoResolve(tc.MetaContext(), teamID, assertions)
		require.NoError(t, err)
		require.Len(t, ret, 2)
		require.Equal(t, assertions[0], ret[0])
		require.Equal(t, assertions[6], ret[1])
	}
}

func TestTeamPlayerIdempotentChangesAssertRole(t *testing.T) {
	// Test change_memberships that do not change role  and if they work
	// correctly with AssertWasRoleOrAboveAt function.

	tc, team, me := setupTestForPrechecks(t, false /* implicitTeam */)
	defer tc.Cleanup()

	uvAlice := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_alice"), EldestSeqno: 1}
	uvBob := keybase1.UserVersion{Uid: libkb.UsernameToUID("t_bob"), EldestSeqno: 1}

	// Initial setup:
	// Add Alice as a writer and Bob as an admin, in separate links.

	memberLists := []*SCTeamMembers{
		{Writers: &[]SCTeamMember{SCTeamMember(uvAlice)}},
		{Admins: &[]SCTeamMember{SCTeamMember(uvBob)}},
	}

	var err error
	var state *TeamSigChainState
	for _, v := range memberLists {
		teamSectionCM := makeTestSCTeamSection(team)
		teamSectionCM.Members = v
		state, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
			teamSectionCM, me, nil /* merkleRoot */)
		require.NoError(t, err)
	}

	require.EqualValues(t, 3, state.GetLatestSeqno())

	makeScl := func(seqno int) keybase1.SigChainLocation {
		return keybase1.SigChainLocation{
			Seqno:   keybase1.Seqno(seqno),
			SeqType: keybase1.SeqType_SEMIPRIVATE,
		}
	}

	err = state.AssertWasRoleOrAboveAt(uvAlice, keybase1.TeamRole_WRITER, makeScl(1))
	require.Error(t, err)
	require.IsType(t, PermissionError{}, err)

	for i := 1; i <= 2; i++ {
		// Bob was only added at seqno 3, so at seqnos 1 and 2 they weren't an
		// admin yet.
		err = state.AssertWasRoleOrAboveAt(uvBob, keybase1.TeamRole_ADMIN, makeScl(i))
		require.Error(t, err)
		require.IsType(t, AdminPermissionError{}, err)
	}

	err = state.AssertWasRoleOrAboveAt(uvAlice, keybase1.TeamRole_WRITER, makeScl(2))
	require.NoError(t, err)

	err = state.AssertWasRoleOrAboveAt(uvBob, keybase1.TeamRole_ADMIN, makeScl(3))
	require.NoError(t, err)

	// Using memberLists, do bunch of idempotent role changes
	for i := 0; i < 2; i++ {
		for _, v := range memberLists {
			teamSectionCM := makeTestSCTeamSection(team)
			teamSectionCM.Members = v
			state, err = appendSigToState(t, team, state, libkb.LinkTypeChangeMembership,
				teamSectionCM, me, nil /* merkleRoot */)
			require.NoError(t, err)
		}
	}

	require.EqualValues(t, 7, state.GetLatestSeqno())

	// Alice is still a writer at every of the new seqnos.
	for i := 2; i <= 7; i++ {
		err = state.AssertWasRoleOrAboveAt(uvAlice, keybase1.TeamRole_WRITER, makeScl(i))
		require.NoError(t, err)
	}

	// Bob is still an admin at every of the new seqnos.
	for i := 3; i <= 7; i++ {
		err = state.AssertWasRoleOrAboveAt(uvBob, keybase1.TeamRole_ADMIN, makeScl(i))
		require.NoError(t, err)
	}
}
