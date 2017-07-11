package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestTeamPlusApplicationKeysExim(t *testing.T) {
	tc := SetupTest(t, "TestTeamPlusApplicationKeysExim", 1)
	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	defer tc.Cleanup()

	name := createTeam(tc)
	team, err := GetForApplicationByStringName(context.TODO(), tc.G, name, keybase1.TeamApplication_KBFS, keybase1.TeamRefreshers{})
	if err != nil {
		t.Fatal(err)
	}

	exported, err := team.ExportToTeamPlusApplicationKeys(context.TODO(), keybase1.Time(0), keybase1.TeamApplication_KBFS)
	if err != nil {
		t.Fatalf("Error during export: %s", err)
	}
	if exported.Name != team.Name().String() {
		t.Fatalf("Got name %s, expected %s", exported.Name, team.Name())
	}
	if !exported.Id.Eq(team.ID) {
		t.Fatalf("Got id %q, expected %q", exported.Id, team.ID)
	}
	expectedKeys, err := team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_KBFS)
	if err != nil {
		t.Fatal(err)
	}
	if len(exported.ApplicationKeys) != len(expectedKeys) {
		t.Fatalf("Got %v applicationKeys, expected %v", len(exported.ApplicationKeys), len(expectedKeys))
	}
}
