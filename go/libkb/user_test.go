package libkb

import (
	"encoding/hex"
	"testing"
)

func TestExportUser(t *testing.T) {
	tc := SetupTest(t, "export_user")
	defer tc.Cleanup()
	alice, err := LoadUser(LoadUserArg{Name: "t_alice"})
	if err != nil {
		t.Fatal(err)
	}

	exportedAlice := alice.Export()

	if hex.EncodeToString(exportedAlice.Uid[:]) != "295a7eea607af32040647123732bc819" {
		t.Fatal("wrong UID", exportedAlice.Uid)
	}

	if exportedAlice.Username != "t_alice" {
		t.Fatal("wrong username", exportedAlice.Username)
	}

	if len(exportedAlice.PublicKeys) != 1 {
		t.Fatal("expected 1 public key", exportedAlice.PublicKeys)
	}

	if exportedAlice.PublicKeys[0].PGPFingerprint != "2373fd089f28f328916b88f99c7927c0bdfdadf9" {
		t.Fatal("wrong fingerprint", exportedAlice.PublicKeys[0].PGPFingerprint)
	}
}
