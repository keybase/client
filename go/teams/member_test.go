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

func TestMemberAddWriter(t *testing.T) {
	t.Skip("not ready")
	tc, u, name := memberSetup(t)
	defer tc.Cleanup()

	if err := AddWriter(context.TODO(), tc.G, name, "t_alice"); err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	s, err := Get(ctx, tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	role := uidRole(ctx, tc, s, u.User.GetUID())
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}

	aliceRole := usernameRole(ctx, tc, s, "t_alice")
	if aliceRole != keybase1.TeamRole_WRITER {
		t.Errorf("role: %s, expected WRITER", aliceRole)
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
