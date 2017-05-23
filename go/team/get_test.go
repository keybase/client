package team

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
)

func TestTeamGet(t *testing.T) {
	t.Skip("flake")
	tc := libkb.SetupTest(t, "team", 1)
	tc.Tp.UpgradePerUserKey = true
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	_, err := Get(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
}

func createTeam(tc libkb.TestContext) string {
	name, err := kbtest.CreateTeam(tc.G)
	if err != nil {
		tc.T.Fatal(err)
	}
	return name
}
