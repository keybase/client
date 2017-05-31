package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func memberSetup(t *testing.T) (libkb.TestContext, *kbtest.FakeUser, string) {
	tc := libkb.SetupTest(t, "team", 1)
	tc.Tp.UpgradePerUserKey = true

	u, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	name := createTeam(tc)

	return tc, u, name
}

func memberSetupMultiple(t *testing.T) (tc libkb.TestContext, owner, other *kbtest.FakeUser, name string) {
	tc = libkb.SetupTest(t, "team", 1)
	tc.Tp.UpgradePerUserKey = true

	other, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	tc.G.Logout()

	owner, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	name = createTeam(tc)

	return tc, owner, other, name
}

func TestMemberOwner(t *testing.T) {
	tc, u, name := memberSetup(t)
	defer tc.Cleanup()

	ctx := context.Background()
	team, err := Get(ctx, tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	role := uidRole(ctx, tc, team, u.User.GetUID())
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}

	aliceRole := usernameRole(ctx, tc, team, "t_alice")
	if aliceRole != keybase1.TeamRole_NONE {
		t.Errorf("role: %s, expected NONE", aliceRole)
	}
}

type addTest struct {
	name        string
	setRoleFunc func(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error
	afterRole   keybase1.TeamRole
}

var addTests = []addTest{
	addTest{name: "owner", setRoleFunc: SetRoleOwner, afterRole: keybase1.TeamRole_OWNER},
	addTest{name: "admin", setRoleFunc: SetRoleAdmin, afterRole: keybase1.TeamRole_ADMIN},
	addTest{name: "writer", setRoleFunc: SetRoleWriter, afterRole: keybase1.TeamRole_WRITER},
	addTest{name: "reader", setRoleFunc: SetRoleReader, afterRole: keybase1.TeamRole_READER},
}

func TestMemberAddX(t *testing.T) {
	for _, test := range addTests {
		testMemberAdd(t, test)
	}
}

func testMemberAdd(t *testing.T, test addTest) {
	tc, owner, other, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := test.setRoleFunc(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	s, err := Get(ctx, tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	role := uidRole(ctx, tc, s, owner.User.GetUID())
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}

	otherRole := usernameRole(ctx, tc, s, other.Username)
	if otherRole != test.afterRole {
		t.Errorf("role: %s, expected %s", otherRole, test.afterRole)
	}
}

func TestMemberRemove(t *testing.T) {
	tc, owner, other, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	s, err := Get(ctx, tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("before remove, seqno: %d", s.Chain.GetLatestSeqno())

	role := uidRole(ctx, tc, s, owner.User.GetUID())
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}

	otherRole := usernameRole(ctx, tc, s, other.Username)
	if otherRole != keybase1.TeamRole_WRITER {
		t.Errorf("role: %s, expected WRITER", otherRole)
	}

	if err := RemoveMember(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	ctx = context.Background()
	s, err = Get(ctx, tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("after remove, seqno: %d", s.Chain.GetLatestSeqno())

	role = uidRole(ctx, tc, s, owner.User.GetUID())
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}

	otherRole = usernameRole(ctx, tc, s, other.Username)
	if otherRole != keybase1.TeamRole_NONE {
		t.Errorf("role: %s, expected NONE", otherRole)
	}
}

func TestMemberChangeRole(t *testing.T) {
	tc, owner, other, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	if err := SetRoleWriter(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	s, err := Get(ctx, tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	role := uidRole(ctx, tc, s, owner.User.GetUID())
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}

	otherRole := usernameRole(ctx, tc, s, other.Username)
	if otherRole != keybase1.TeamRole_WRITER {
		t.Errorf("role: %s, expected WRITER", otherRole)
	}

	if err := SetRoleReader(context.TODO(), tc.G, name, other.Username); err != nil {
		t.Fatal(err)
	}

	ctx = context.Background()
	s, err = Get(ctx, tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	role = uidRole(ctx, tc, s, owner.User.GetUID())
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}

	otherRole = usernameRole(ctx, tc, s, other.Username)
	if otherRole != keybase1.TeamRole_READER {
		t.Errorf("role: %s, expected READER", otherRole)
	}
}

func uidRole(ctx context.Context, tc libkb.TestContext, team *Team, uid keybase1.UID) keybase1.TeamRole {
	uv, err := loadUserVersionByUID(ctx, tc.G, uid)
	if err != nil {
		tc.T.Fatal(err)
	}
	return uvRole(tc, team, uv)
}

func usernameRole(ctx context.Context, tc libkb.TestContext, team *Team, username string) keybase1.TeamRole {
	uv, err := loadUserVersionByUsername(ctx, tc.G, username)
	if err != nil {
		tc.T.Fatal(err)
	}
	return uvRole(tc, team, uv)
}

func uvRole(tc libkb.TestContext, team *Team, uv UserVersion) keybase1.TeamRole {
	role, err := team.Chain.GetUserRole(uv)
	if err != nil {
		tc.T.Fatal(err)
	}
	return role
}
