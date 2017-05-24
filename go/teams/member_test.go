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

	upak, _, err := tc.G.GetUPAKLoader().Load(libkb.NewLoadUserByUIDArg(context.Background(), tc.G, u.User.GetUID()))
	if err != nil {
		t.Fatal(err)
	}
	uv := NewUserVersion(upak.Base.Username, upak.Base.EldestSeqno)
	t.Logf("user eldest seqno: %d", upak.Base.EldestSeqno)

	role, err := s.GetUserRole(uv)
	if err != nil {
		t.Fatal(err)
	}
	if role != keybase1.TeamRole_OWNER {
		t.Errorf("role: %s, expected OWNER", role)
	}
}

func TestMemberAdd(t *testing.T) {
	tc, u, name := memberSetup(t)
	defer tc.Cleanup()

	_ = u
	_ = name
}
