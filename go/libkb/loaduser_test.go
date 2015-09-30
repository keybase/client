package libkb

import "testing"

func TestLoadUserPlusKeys(t *testing.T) {
	tc := SetupTest(t, "user plus keys")
	defer tc.Cleanup()
	for i := 0; i < 10; i++ {
		u, err := LoadUserPlusKeys(tc.G, "t_alice", true)
		if err != nil {
			t.Fatal(err)
		}
		if u.Uid != "295a7eea607af32040647123732bc819" {
			t.Errorf("t_alice uid: %s, expected 295a7eea607af32040647123732bc819", u.Uid)
		}
	}

	for _, username := range []string{"t_alice", "t_bob", "t_charlie", "t_doug", "t_ellen"} {
		_, err := LoadUserPlusKeys(tc.G, username, true)
		if err != nil {
			t.Fatal(err)
		}
	}
}
