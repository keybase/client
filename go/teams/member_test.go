package teams

import (
	"testing"

	"golang.org/x/net/context"

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
	if err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	otherB, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	owner, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	name = createTeam(tc)

	return tc, owner, otherA, otherB, name
}

// creates a root team and a subteam.  owner is the owner of root, otherA is an admin, otherB is just a user.
// no members in subteam.
func memberSetupSubteam(t *testing.T) (tc libkb.TestContext, owner, otherA, otherB *kbtest.FakeUser, root, sub string) {
	tc, owner, otherA, otherB, root = memberSetupMultiple(t)

	// add otherA and otherB as admins to rootName
	_, err := AddMember(context.TODO(), tc.G, root, otherA.Username, keybase1.TeamRole_ADMIN)
	if err != nil {
		t.Fatal(err)
	}
	assertRole(tc, root, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, root, otherA.Username, keybase1.TeamRole_ADMIN)
	assertRole(tc, root, otherB.Username, keybase1.TeamRole_NONE)

	// create a subteam
	rootTeamName, err := keybase1.TeamNameFromString(root)
	if err != nil {
		t.Fatal(err)
	}
	subPart := "sub"
	_, err = CreateSubteam(context.TODO(), tc.G, subPart, rootTeamName)
	if err != nil {
		t.Fatal(err)
	}
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

func TestMemberRemove(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	if err := RemoveMember(context.TODO(), tc.G, name, other.Username, false); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)
}

func TestMemberChangeRole(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	if err := SetRoleReader(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)
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

	_, boxes, _, _, err := tm.changeMembershipSection(context.TODO(), req)
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

	_, boxes, _, _, err := tm.changeMembershipSection(context.TODO(), req)
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
	if err := RemoveMember(context.TODO(), tc.G, name, other.Username, false); err != nil {
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

	secretAfter := after.Data.PerTeamKeySeeds[after.Generation()].Seed.ToBytes()
	secretBefore := before.Data.PerTeamKeySeeds[before.Generation()].Seed.ToBytes()
	if libkb.SecureByteArrayEq(secretAfter, secretBefore) {
		t.Error("Team secret did not change when member removed")
	}
}

func TestMemberAddNotAUser(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	tc.G.SetServices(externals.GetServices())

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

	tc.G.SetServices(externals.GetServices())

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
	details, err := Details(context.TODO(), tc.G, name, true)
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

	annotatedTeamList, err := List(context.TODO(), tc.G, keybase1.TeamListArg{UserAssertion: "", All: true})
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

	details, err := Details(context.TODO(), tc.G, name, true)
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

	blob := "u1@keybase.io u2@keybase.io\nu3@keybase.io,u4@keybase.io\tu5@keybase.io,u6@keybase.io, u7@keybase.io\n\n\n"

	res, err := AddEmailsBulk(context.TODO(), tc.G, name, blob, keybase1.TeamRole_WRITER)
	if err != nil {
		t.Fatal(err)
	}
	emails := []string{"u1@keybase.io", "u2@keybase.io", "u3@keybase.io", "u4@keybase.io", "u5@keybase.io", "u6@keybase.io", "u7@keybase.io"}

	if len(res.Invited) != len(emails) {
		t.Errorf("num invited: %d, expected %d", len(res.Invited), len(emails))
	}
	if len(res.AlreadyInvited) != 0 {
		t.Errorf("num already invited: %d, expected 0", len(res.AlreadyInvited))
	}
	if len(res.Malformed) != 0 {
		t.Errorf("num malformed: %d, expected 0", len(res.Malformed))
	}

	for _, e := range emails {
		assertInvite(tc, name, e, "email", keybase1.TeamRole_WRITER)
	}
}

func TestMemberListInviteUsername(t *testing.T) {
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

	// List can return stale results for invites, so do a force load of the team to refresh the cache.
	// In the real world, hopefully gregor would cause this.
	Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})

	annotatedTeamList, err := List(context.TODO(), tc.G, keybase1.TeamListArg{UserAssertion: "", All: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(annotatedTeamList.AnnotatedActiveInvites) != 1 {
		t.Fatalf("active invites: %d, expected 1", len(annotatedTeamList.AnnotatedActiveInvites))
	}
	for _, invite := range annotatedTeamList.AnnotatedActiveInvites {
		if invite.TeamName != name {
			t.Errorf("invite team name: %q, expected %q", invite.TeamName, name)
		}
		if string(invite.Name) != username {
			t.Errorf("invite username: %q, expected %q", invite.Name, username)
		}
	}
}

func TestMemberAddAsImplicitAdmin(t *testing.T) {
	tc, owner, otherA, otherB, _, subteamName := memberSetupSubteam(t)
	defer tc.Cleanup()

	// owner created a subteam, otherA is implicit admin, otherB is nobody
	// (all of that tested in memberSetupSubteam)

	// switch to `otherA` user
	tc.G.Logout()
	if err := otherA.Login(tc.G); err != nil {
		t.Fatal(err)
	}

	// otherA has the power to add otherB to the subteam
	res, err := AddMember(context.TODO(), tc.G, subteamName, otherB.Username, keybase1.TeamRole_WRITER)
	if err != nil {
		t.Fatal(err)
	}
	if res.User.Username != otherB.Username {
		t.Errorf("AddMember result username %q does not match arg username %q", res.User.Username, otherB.Username)
	}
	// otherB should now be a writer
	assertRole(tc, subteamName, otherB.Username, keybase1.TeamRole_WRITER)

	// owner, otherA should still be non-members
	assertRole(tc, subteamName, owner.Username, keybase1.TeamRole_NONE)
	assertRole(tc, subteamName, otherA.Username, keybase1.TeamRole_NONE)
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
	tc.G.Logout()

	if err := otherA.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, name, false); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	if err := otherB.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := Leave(context.TODO(), tc.G, name, false); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

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
	tc.G.Resolver.EnableCaching()

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

func assertInvite(tc libkb.TestContext, name, username, typ string, role keybase1.TeamRole) {
	tc.T.Logf("looking for invite for %s/%s w/ role %s in team %s", username, typ, role, name)
	iname := keybase1.TeamInviteName(username)
	itype, err := keybase1.TeamInviteTypeFromString(typ, true)
	if err != nil {
		tc.T.Fatal(err)
	}
	invite, err := memberInvite(context.TODO(), tc.G, name, iname, itype)
	if err != nil {
		tc.T.Fatal(err)
	}
	if invite == nil {
		tc.T.Fatalf("no invite found for team %s %s/%s", name, username, typ)
	}
	if invite.Role != role {
		tc.T.Fatalf("invite role: %s, expected %s", invite.Role, role)
	}
}

func assertNoInvite(tc libkb.TestContext, name, username, typ string) {
	iname := keybase1.TeamInviteName(username)
	itype, err := keybase1.TeamInviteTypeFromString(typ, true)
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
	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "sub", parentName)
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

	subteamID, err := CreateSubteam(context.TODO(), tcs[0].G, "sub", parentName)
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

	if err := RemoveMember(context.TODO(), tc.G, name, username, false); err != nil {
		t.Fatal(err)
	}

	assertNoInvite(tc, name, "561247eb1cc3b0f5dc9d9bf299da5e19%0", "keybase")
	assertRole(tc, name, username, keybase1.TeamRole_NONE)
}

func TestMemberCancelInviteSocial(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	tc.G.SetServices(externals.GetServices())

	username := "not_on_kb_yet@twitter"
	_, err := AddMember(context.TODO(), tc.G, name, username, keybase1.TeamRole_READER)
	if err != nil {
		t.Fatal(err)
	}
	assertInvite(tc, name, "not_on_kb_yet", "twitter", keybase1.TeamRole_READER)

	if err := RemoveMember(context.TODO(), tc.G, name, username, false); err != nil {
		t.Fatal(err)
	}

	assertNoInvite(tc, name, "not_on_kb_yet", "twitter")
}

func TestMemberCancelInviteEmail(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	tc.G.SetServices(externals.GetServices())

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
