package libkb

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol"
)

func TestLoadUserPlusKeys(t *testing.T) {
	tc := SetupTest(t, "user plus keys")
	defer tc.Cleanup()
	for i := 0; i < 10; i++ {
		u, err := LoadUserPlusKeys(tc.G, "295a7eea607af32040647123732bc819", true)
		if err != nil {
			t.Fatal(err)
		}
		if u.Username != "t_alice" {
			t.Errorf("username: %s, expected t_alice", u.Username)
		}
	}

	for _, uid := range []keybase1.UID{"295a7eea607af32040647123732bc819", "afb5eda3154bc13c1df0189ce93ba119", "9d56bd0c02ac2711e142faf484ea9519", "c4c565570e7e87cafd077509abf5f619", "561247eb1cc3b0f5dc9d9bf299da5e19"} {
		_, err := LoadUserPlusKeys(tc.G, uid, true)
		if err != nil {
			t.Fatal(err)
		}
	}
}
