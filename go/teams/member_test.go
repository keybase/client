package teams

import (
	"sort"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func memberSetup(t *testing.T) (libkb.TestContext, *kbtest.FakeUser, string) {
	tc := SetupTest(t, "team", 1)

	u, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	name := createTeam(tc)

	return tc, u, name
}

func memberSetupMultiple(t *testing.T) (tc libkb.TestContext, owner, otherA, otherB *kbtest.FakeUser, name string) {
	tc = SetupTest(t, "team", 1)

	otherA, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	tc.G.Logout(context.TODO())

	otherB, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	tc.G.Logout(context.TODO())

	owner, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name = createTeam(tc)
	t.Logf("Created team %q", name)

	return tc, owner, otherA, otherB, name
}

// creates a root team and a subteam.  owner is the owner of root, otherA is an admin, otherB is just a user.
// no members in subteam.
func memberSetupSubteam(t *testing.T) (tc libkb.TestContext, owner, otherA, otherB *kbtest.FakeUser, root, sub string) {
	tc, owner, otherA, otherB, root = memberSetupMultiple(t)

	t.Logf("mss owner: %v", owner.Username)
	t.Logf("mss otherA: %v", otherA.Username)
	t.Logf("mss otherB: %v", otherB.Username)

	// add otherA and otherB as admins to rootName
	_, err := AddMember(context.TODO(), tc.G, root, otherA.Username, keybase1.TeamRole_ADMIN)
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
	name        string
	setRoleFunc func(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error
	afterRole   keybase1.TeamRole
}

var setRoleTests = []setRoleTest{
	setRoleTest{name: "owner", setRoleFunc: SetRoleOwner, afterRole: keybase1.TeamRole_OWNER},
	setRoleTest{name: "admin", setRoleFunc: SetRoleAdmin, afterRole: keybase1.TeamRole_ADMIN},
	setRoleTest{name: "writer", setRoleFunc: SetRoleWriter, afterRole: keybase1.TeamRole_WRITER},
	setRoleTest{name: "reader", setRoleFunc: SetRoleReader, afterRole: keybase1.TeamRole_READER},
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

	res, err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole_READER)
	if err != nil {
		t.Fatal(err)
	}
	if res.User.Username != other.Username {
		t.Errorf("AddMember result username %q does not match arg username %q", res.User.Username, other.Username)
	}

	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)

	// second AddMember should return err
	if _, err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole_WRITER); err == nil {
		t.Errorf("second AddMember succeeded, should have failed since user already a member")
	}

	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)
}

func TestMemberAddInvalidRole(t *testing.T) {
	tc, _, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if _, err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole(8888)); err == nil {
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

	_, boxes, _, _, _, err := tm.changeMembershipSection(context.TODO(), req, false /* skipKeyRotation */)
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

	_, boxes, _, _, _, err := tm.changeMembershipSection(context.TODO(), req, false /* skipKeyRotation */)
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

	_, err := AddMember(context.TODO(), tc.G, name, "not_a_kb_user", keybase1.TeamRole_READER)
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

	res, err := AddMember(context.TODO(), tc.G, name, "not_on_kb_yet@twitter", keybase1.TeamRole_OWNER)
	if err == nil {
		t.Fatal("should not be able to invite a social user as an owner")
	}

	res, err = AddMember(context.TODO(), tc.G, name, "not_on_kb_yet@twitter", keybase1.TeamRole_READER)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Invited {
		t.Fatal("res.Invited should be set")
	}

	assertInvite(tc, name, "not_on_kb_yet", "twitter", keybase1.TeamRole_READER)

	// second AddMember should return err
	if _, err := AddMember(context.TODO(), tc.G, name, "not_on_kb_yet@twitter", keybase1.TeamRole_WRITER); err == nil {
		t.Errorf("second AddMember succeeded, should have failed since user already invited")
	}

	// existing invite should be untouched
	assertInvite(tc, name, "not_on_kb_yet", "twitter", keybase1.TeamRole_READER)
}

// add user without puk to a team, should create invite link
func TestMemberAddNoPUK(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	inviteNoPUK := func(username string, uid keybase1.UID, role keybase1.TeamRole) {

		res, err := AddMember(context.TODO(), tc.G, name, username, role)
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
		if _, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_WRITER); err == nil {
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
	res, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER)
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
	if _, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_WRITER); err == nil {
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
	_, err := AddMember(context.TODO(), tc.G, name, otherA.Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	_, err = AddMember(context.TODO(), tc.G, name, otherB.Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	details, err := Details(context.TODO(), tc.G, name)
	require.NoError(t, err)

	require.Len(t, details.Members.Admins, 2)
	for _, admin := range details.Members.Admins {
		require.Equal(t, admin.Status, keybase1.TeamMemberStatus_ACTIVE)
	}

	// Logout owner
	kbtest.Logout(tc)

	otherA.Login(tc.G)
	kbtest.ResetAccount(tc, otherA)

	otherB.Login(tc.G)
	kbtest.DeleteAccount(tc, otherB)

	owner.Login(tc.G)

	details, err = Details(context.TODO(), tc.G, name)
	require.NoError(t, err)

	require.Len(t, details.Members.Admins, 1)
	require.Equal(t, otherA.Username, details.Members.Admins[0].Username)
	require.Equal(t, keybase1.TeamMemberStatus_RESET, details.Members.Admins[0].Status)
}

func TestMemberAddEmail(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	address := "noone@keybase.io"

	if err := InviteEmailMember(context.TODO(), tc.G, name, address, keybase1.TeamRole_OWNER); err == nil {
		t.Fatal("should not be able to invite an owner over email")
	}

	if err := InviteEmailMember(context.TODO(), tc.G, name, address, keybase1.TeamRole_READER); err != nil {
		t.Fatal(err)
	}

	assertInvite(tc, name, address, "email", keybase1.TeamRole_READER)

	// second InviteEmailMember should return err
	if err := InviteEmailMember(context.TODO(), tc.G, name, address, keybase1.TeamRole_WRITER); err == nil {
		t.Errorf("second InviteEmailMember succeeded, should have failed since user already invited")
	}

	// existing invite should be untouched
	assertInvite(tc, name, address, "email", keybase1.TeamRole_READER)

	annotatedTeamList, err := ListAll(context.TODO(), tc.G, keybase1.TeamListTeammatesArg{})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, invite := range annotatedTeamList.AnnotatedActiveInvites {
		if invite.TeamName == name && string(invite.Name) == address {
			found = true
		}
	}
	if !found {
		t.Fatal("List --all does not list invite.")
	}

	details, err := Details(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	found = false
	for _, invite := range details.AnnotatedActiveInvites {
		if invite.TeamName == name && string(invite.Name) == address {
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

	blob := "h@j.k,u1@keybase.io, u2@keybase.io\nu3@keybase.io,u4@keybase.io, u5@keybase.io,u6@keybase.io, u7@keybase.io\n\n\nFull Name <fullname@keybase.io>, Someone Else <someone@keybase.io>,u8@keybase.io\n\nXXXXXXXXXXXX"

	res, err := AddEmailsBulk(context.TODO(), tc.G, name, blob, keybase1.TeamRole_WRITER)
	if err != nil {
		t.Fatal(err)
	}
	emails := []string{"u1@keybase.io", "u2@keybase.io", "u3@keybase.io", "u4@keybase.io", "u5@keybase.io", "u6@keybase.io", "u7@keybase.io", "fullname@keybase.io", "someone@keybase.io", "u8@keybase.io"}

	if len(res.Invited) != len(emails) {
		t.Logf("invited: %+v", res.Invited)
		t.Errorf("num invited: %d, expected %d", len(res.Invited), len(emails))
	}
	if len(res.AlreadyInvited) != 0 {
		t.Errorf("num already invited: %d, expected 0", len(res.AlreadyInvited))
	}
	require.Len(t, res.Malformed, 2)
	for _, e := range emails {
		assertInvite(tc, name, e, "email", keybase1.TeamRole_WRITER)
	}
}

func TestMemberListInviteUsername(t *testing.T) {
	tc, user, name := memberSetup(t)
	defer tc.Cleanup()

	username := "t_ellen"
	res, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER)
	require.NoError(t, err)
	require.True(t, res.Invited)
	require.Equal(t, username, res.User.Username)

	// List can return stale results for invites, so do a force load of the team to refresh the cache.
	// In the real world, hopefully gregor would cause this.
	Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})

	annotatedTeamList, err := ListAll(context.TODO(), tc.G, keybase1.TeamListTeammatesArg{})
	require.NoError(t, err)
	require.Equal(t, 0, len(annotatedTeamList.AnnotatedActiveInvites))
	require.Equal(t, 2, len(annotatedTeamList.Teams))

	var foundMember bool
	for _, member := range annotatedTeamList.Teams {
		require.Equal(t, name, member.FqName)
		if member.Username == username {
			foundMember = true
		} else if member.Username != user.Username {
			t.Fatalf("Unexpected member name %s", member.Username)
		}
	}
	require.True(t, foundMember)
}

func TestMemberAddAsImplicitAdmin(t *testing.T) {
	tc, owner, otherA, otherB, _, subteamName := memberSetupSubteam(t)
	defer tc.Cleanup()

	// owner created a subteam, otherA is implicit admin, otherB is nobody
	// (all of that tested in memberSetupSubteam)

	switchTo := func(to *kbtest.FakeUser) {
		tc.G.Logout(context.TODO())
		err := to.Login(tc.G)
		require.NoError(t, err)
	}

	switchTo(otherA)

	// otherA has the power to add otherB to the subteam
	res, err := AddMember(context.TODO(), tc.G, subteamName, otherB.Username, keybase1.TeamRole_WRITER)
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
	ias, err := ImplicitAdmins(context.TODO(), tc.G, subteamID)
	require.NoError(t, err)
	t.Logf("res: %v", spew.Sdump(ias))
	require.Len(t, ias, 2, "number of implicit admins")
	sort.Slice(ias, func(i, _ int) bool {
		return ias[i].Uv.Eq(owner.GetUserVersion())
	})
	require.Equal(t, owner.GetUserVersion(), ias[0].Uv)
	require.Equal(t, owner.Username, ias[0].Username)
	require.True(t, ias[0].Status.IsActive())
	require.Equal(t, otherA.GetUserVersion(), ias[1].Uv)
	require.Equal(t, otherA.Username, ias[1].Username)
	require.True(t, ias[1].Status.IsActive())
}

func TestLeave(t *testing.T) {
	tc, owner, otherA, otherB, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleAdmin(context.TODO(), tc.G, name, otherA.Username); err != nil {
		t.Fatal(err)
	}
	if err := SetRoleWriter(context.TODO(), tc.G, name, otherB.Username); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout(context.TODO())

	if err := otherA.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, name, false); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout(context.TODO())

	if err := otherB.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, name, false); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout(context.TODO())

	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if team.IsMember(context.TODO(), otherA.GetUserVersion()) {
		t.Fatal("Admin user is still member after leave.")
	}
	if team.IsMember(context.TODO(), otherB.GetUserVersion()) {
		t.Fatal("Writer user is still member after leave.")
	}
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

	tc.G.Logout(context.TODO())

	if err := otherA.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, subteamName, false); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout(context.TODO())

	if err := otherB.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, subteamName, false); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout(context.TODO())

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
	tc.G.Logout(context.TODO())
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

func TestLeaveAsReader(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates fennel_network")
	teamName, teamID := createTeam2(*tcs[0])

	t.Logf("U0 adds U1 to the root")
	_, err := AddMember(context.Background(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
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
	res, err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole_READER)
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
		tc.T.Fatal(err)
	}
	if role != expected {
		tc.T.Fatalf("role: %s, expected %s", role, expected)
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
	if err != nil {
		tc.T.Fatal(err)
	}
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
	_, err = AddMember(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	t.Logf("now U1 can load the subteam, but not U2")
	_, err = tcs[1].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.NoError(t, err, "U1 should able to load subteam with implicit admin status")
	_, err = tcs[2].G.GetTeamLoader().ImplicitAdmins(context.TODO(), *subteamID)
	require.Error(t, err, "U2 still isn't in the subteam at yet, shouldn't be able to load")

	t.Logf("U1 can add U2 to the subteam")
	_, err = AddMember(context.TODO(), tcs[1].G, parentName.String(), fus[2].Username, keybase1.TeamRole_ADMIN)
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

	_, err = AddMember(context.TODO(), tcs[0].G, parentName.String(), fus[1].Username, keybase1.TeamRole_WRITER)
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
	_, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER)
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
	_, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER)
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
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	tc.G.SetProofServices(externals.NewProofServices(tc.G))

	address := "noone@keybase.io"

	if err := InviteEmailMember(context.TODO(), tc.G, name, address, keybase1.TeamRole_READER); err != nil {
		t.Fatal(err)
	}
	assertInvite(tc, name, address, "email", keybase1.TeamRole_READER)

	if err := CancelEmailInvite(context.TODO(), tc.G, name, address); err != nil {
		t.Fatal(err)
	}

	assertNoInvite(tc, name, address, "email")

	// check error type for an email address with no invite
	err := CancelEmailInvite(context.TODO(), tc.G, name, "nope@keybase.io")
	if err == nil {
		t.Fatal("expected error canceling email invite for unknown email address")
	}
	if _, ok := err.(libkb.NotFoundError); !ok {
		t.Errorf("expected libkb.NotFoundError, got %T", err)
	}

	// check error type for unknown team
	err = CancelEmailInvite(context.TODO(), tc.G, "notateam", address)
	if err == nil {
		t.Fatal("expected error canceling email invite for unknown team")
	}
	if _, ok := err.(TeamDoesNotExistError); !ok {
		t.Errorf("expected teams.TeamDoesNotExistError, got %T", err)
	}
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
	_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
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
					tcs[userIndexOperator].G, rootName.String(), fus[userIndexTarget].Username, keybase1.TeamRole_READER)
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
		doRotate := i%3 == 1

		t.Logf("parallel start")

		errCh1 := mod(0, 2, true)
		errCh2 := mod(1, 3, true)
		var errCh3 <-chan error
		if doRotate {
			errCh3 = rotate(0)
		}
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
	_, err := AddMember(context.TODO(), tcs[0].G, rootName.String(), fus[1].Username, keybase1.TeamRole_ADMIN)
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
					tcs[userIndexOperator].G, rootName.String(), fus[userIndexTarget].Username, keybase1.TeamRole_READER)
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

	res, err := AddMember(context.TODO(), tc.G, name, username, role)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Invited {
		t.Fatal("res.Invited should be set")
	}

	fqUID := string(uid) + "%1"
	assertInvite(tc, name, fqUID, "keybase", role)

	if err := EditMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_ADMIN); err != nil {
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

	res, err := AddMember(context.TODO(), tc.G, name, username, role)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Invited {
		t.Fatal("res.Invited should be set")
	}

	fqUID := string(uid) + "%1"
	assertInvite(tc, name, fqUID, "keybase", role)

	if err := EditMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_OWNER); err != nil {
		t.Fatal(err)
	}
	assertInvite(tc, name, fqUID, "keybase", keybase1.TeamRole_OWNER)
}

func TestFollowResetAdd(t *testing.T) {
	tc := SetupTest(t, "team", 1)

	alice, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	team := createTeam(tc)
	t.Logf("Created team %q", team)
	tc.G.Logout(context.TODO())

	bob, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	tc.G.Logout(context.TODO())

	charlie, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	tc.G.Logout(context.TODO())

	// alice tracks bob and charlie
	alice.Login(tc.G)
	_, err = kbtest.RunTrack(tc, alice, bob.Username)
	require.NoError(t, err)
	_, err = kbtest.RunTrack(tc, alice, charlie.Username)
	require.NoError(t, err)

	// alice lets charlie into the team
	_, err = AddMember(context.TODO(), tc.G, team, charlie.Username, keybase1.TeamRole_ADMIN)
	require.NoError(t, err)

	// bob and charlie reset
	tc.G.Logout(context.TODO())
	bob.Login(tc.G)
	kbtest.ResetAccount(tc, bob)
	tc.G.Logout(context.TODO())
	charlie.Login(tc.G)
	kbtest.ResetAccount(tc, charlie)
	tc.G.Logout(context.TODO())

	// alice fails to invite bob into the team since her tracking statement of him is broken
	alice.Login(tc.G)
	_, err = AddMember(context.TODO(), tc.G, team, bob.Username, keybase1.TeamRole_ADMIN)
	require.Error(t, err)
	require.True(t, libkb.IsIdentifyProofError(err))

	// AddMembers also fails
	_, err = AddMembers(context.TODO(), tc.G, team, []keybase1.UserRolePair{{AssertionOrEmail: bob.Username, Role: keybase1.TeamRole_ADMIN}})
	require.Error(t, err)
	amerr, ok := err.(AddMembersError)
	require.True(t, ok)
	require.True(t, libkb.IsIdentifyProofError(amerr.Err))

	// alice succeeds in removing charlie from the team, since her broken tracking statement
	// is ignored for a team removal.
	err = RemoveMember(context.TODO(), tc.G, team, charlie.Username)
	require.NoError(t, err)

}
