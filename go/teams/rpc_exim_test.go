package teams

import (
	"golang.org/x/net/context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestTeamPlusApplicationKeysExim(t *testing.T) {
	tc := libkb.SetupTest(t, "TestTeamPlusApplicationKeysExim", 1)
	tc.Tp.UpgradePerUserKey = true
	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	defer tc.Cleanup()

	name := createTeam(tc)
	team, err := Get(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	exported, err := team.ExportToTeamPlusApplicationKeys(context.TODO(), keybase1.Time(0), keybase1.TeamApplication_KBFS)
	if err != nil {
		t.Errorf("Error during export: %s", err)
	}
	if exported.Name != team.Name {
		t.Errorf("Got name %s, expected %s", exported.Name, team.Name)
	}
	if exported.Id != team.Chain.GetID() {
		t.Errorf("Got id %s, expected %s", exported.Id, team.Chain.GetID())
	}
	expectedKeys, err := team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_KBFS)
	if err != nil {
		t.Fatal(err)
	}
	if len(exported.ApplicationKeys) != len(expectedKeys) {
		t.Errorf("Got %s applicationKeys, expected %s", len(exported.ApplicationKeys), len(expectedKeys))
	}
}
