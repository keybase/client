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

	s, err := Get(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	role := uidRole(tc, s, u.User.GetUID())
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}

	aliceRole := usernameRole(tc, s, "t_alice")
	if aliceRole != keybase1.TeamRole_NONE {
		t.Errorf("role: %s, expected NONE", aliceRole)
	}
}

func TestMemberAdd(t *testing.T) {
	tc, u, name := memberSetup(t)
	defer tc.Cleanup()

	_ = u
	_ = name
}

func uidRole(tc libkb.TestContext, state *TeamSigChainState, uid keybase1.UID) keybase1.TeamRole {
	return uvRole(tc, state, userVersion(tc, uid))
}

func usernameRole(tc libkb.TestContext, state *TeamSigChainState, username string) keybase1.TeamRole {
	user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, username))
	if err != nil {
		tc.T.Fatal(err)
	}
	return uvRole(tc, state, userVersion(tc, user.GetUID()))
}

func uvRole(tc libkb.TestContext, state *TeamSigChainState, uv UserVersion) keybase1.TeamRole {
	role, err := state.GetUserRole(uv)
	if err != nil {
		tc.T.Fatal(err)
	}
	return role
}

func userVersion(tc libkb.TestContext, uid keybase1.UID) UserVersion {
	arg := libkb.NewLoadUserByUIDArg(context.Background(), tc.G, uid)
	upak, _, err := tc.G.GetUPAKLoader().Load(arg)
	if err != nil {
		tc.T.Fatal(err)
	}

	return NewUserVersion(upak.Base.Username, upak.Base.EldestSeqno)
}
