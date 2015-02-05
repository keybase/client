package libkb

import (
	"path"
	"testing"
)

func TestGPGKeyring(t *testing.T) {
	tc := SetupTest(t, "gpg_cli")
	defer tc.Cleanup()
	err := tc.GenerateGPGKeyring("no@no.no")
	if err != nil {
		t.Fatal(err)
	}

	for _, fn := range []string{"secring.gpg", "pubring.gpg"} {
		p := path.Join(tc.Tp.GPGHome, fn)
		ok, err := FileExists(p)
		if err != nil {
			t.Fatal(err)
		}
		if !ok {
			t.Errorf("file not found: %s", p)
		}
	}
}
