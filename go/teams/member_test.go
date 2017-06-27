package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
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

func memberSetupMultiple(t *testing.T) (tc libkb.TestContext, owner, other_a, other_b *kbtest.FakeUser, name string) {
	tc = SetupTest(t, "team", 1)

	other_a, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	other_b, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	owner, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	name = createTeam(tc)

	return tc, owner, other_a, other_b, name
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

func TestMemberAdd(t *testing.T) {
	tc, _, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)

	if err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole_READER); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)

	// second AddMember should return err
	if err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole_WRITER); err == nil {
		t.Errorf("second AddMember succeeded, should have failed since user already a member")
	}

	assertRole(tc, name, other.Username, keybase1.TeamRole_READER)
}

func TestMemberAddInvalidRole(t *testing.T) {
	tc, _, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := AddMember(context.TODO(), tc.G, name, other.Username, keybase1.TeamRole(8888)); err == nil {
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

	if err := RemoveMember(context.TODO(), tc.G, name, other.Username); err != nil {
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
	tm, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	_, boxes, _, err := tm.changeMembershipSection(context.TODO(), req)
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
	tm, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	_, boxes, _, err := tm.changeMembershipSection(context.TODO(), req)
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

	before, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if before.Box.Generation != 1 {
		t.Fatalf("initial team generation: %d, expected 1", before.Box.Generation)
	}

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}
	if err := RemoveMember(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_NONE)

	after, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if after.Box.Generation != 2 {
		t.Errorf("after member remove: team generation: %d, expected 2", after.Box.Generation)
	}

	if after.Box.Ctext == before.Box.Ctext {
		t.Error("TeamBox.Ctext did not change when member removed")
	}
}

func TestLeave(t *testing.T) {
	tc, owner, other_a, other_b, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleAdmin(context.TODO(), tc.G, name, other_a.Username); err != nil {
		t.Fatal(err)
	}
	if err := SetRoleWriter(context.TODO(), tc.G, name, other_b.Username); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	if err := other_a.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := LeaveTeam(context.TODO(), tc.G, name, false); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	if err := other_b.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := LeaveTeam(context.TODO(), tc.G, name, false); err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	team, err := GetForTeamManagementByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
	if team.IsMember(context.TODO(), other_a.GetUserVersion()) {
		t.Fatal("Admin user is still member after leave.")
	}
	if team.IsMember(context.TODO(), other_b.GetUserVersion()) {
		t.Fatal("Writer user is still member after leave.")
	}
}

func assertRole(tc libkb.TestContext, name, username string, expected keybase1.TeamRole) {
	role, err := MemberRole(context.TODO(), tc.G, name, username)
	if err != nil {
		tc.T.Fatal(err)
	}
	if role != expected {
		tc.T.Fatalf("role: %s, expected %s", role, expected)
	}
}
