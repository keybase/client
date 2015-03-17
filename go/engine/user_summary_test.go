package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestUserSummary(t *testing.T) {
	tc := SetupEngineTest(t, "usersummary")
	defer tc.Cleanup()

	uids := []libkb.UID{
		libkb.UsernameToUID("t_alice"),
		libkb.UsernameToUID("t_bob"),
		libkb.UsernameToUID("t_charlie"),
	}

	eng := NewUserSummary(uids)
	ctx := &Context{}
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	sums := eng.Summaries()
	if len(sums) != 3 {
		t.Errorf("# summaries: %d, expected 3", len(sums))
	}

	for _, uid := range uids {
		if _, ok := sums[uid.String()]; !ok {
			t.Errorf("no summary for %s in result", uid)
		}
	}
}
