package teams

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func TestIdentifyLite(t *testing.T) {
	tc, _, name := memberSetup(t)

	team, err := GetForTestByStringName(context.Background(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}

	// test identify by assertion only
	var assertions = []string{"team:" + name, "tid:" + team.ID.String()}
	for _, assertion := range assertions {
		au, err := libkb.ParseAssertionURL(tc.G.MakeAssertionContext(), assertion, true)
		if err != nil {
			t.Fatal(err)
		}
		res, err := IdentifyLite(context.Background(), tc.G, keybase1.IdentifyLiteArg{Assertion: assertion}, au)
		if err != nil {
			t.Fatal(err)
		}
		if res.Ul.Name != name {
			t.Errorf("assertion: %s, id lite name: %s, expected %s", assertion, res.Ul.Name, name)
		}

		if res.Ul.Id.String() != team.ID.String() {
			t.Errorf("assertion: %s, id lite id: %s, expected %s", assertion, res.Ul.Id, team.ID)
		}
	}

	// test identify by id and assertions
	for _, assertion := range assertions {
		au, err := libkb.ParseAssertionURL(tc.G.MakeAssertionContext(), assertion, true)
		if err != nil {
			t.Fatal(err)
		}
		res, err := IdentifyLite(context.Background(), tc.G, keybase1.IdentifyLiteArg{Id: team.ID.AsUserOrTeam(), Assertion: assertion}, au)
		if err != nil {
			t.Fatal(err)
		}
		if res.Ul.Name != name {
			t.Errorf("assertion: %s, id lite name: %s, expected %s", assertion, res.Ul.Name, name)
		}

		if res.Ul.Id.String() != team.ID.String() {
			t.Errorf("assertion: %s, id lite id: %s, expected %s", assertion, res.Ul.Id, team.ID)
		}
	}

	// test identify by id only
	var empty libkb.AssertionKeybase
	res, err := IdentifyLite(context.Background(), tc.G, keybase1.IdentifyLiteArg{Id: team.ID.AsUserOrTeam()}, empty)
	if err != nil {
		t.Fatal(err)
	}
	if res.Ul.Name != name {
		t.Errorf("id lite name: %s, expected %s", res.Ul.Name, name)
	}

	if res.Ul.Id.String() != team.ID.String() {
		t.Errorf("id lite id: %s, expected %s", res.Ul.Id, team.ID)
	}
}
