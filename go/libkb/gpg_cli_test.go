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

func TestGPGImportSecret(t *testing.T) {
	tc := SetupTest(t, "gpg_cli")
	defer tc.Cleanup()
	if err := tc.GenerateGPGKeyring("no@no.no"); err != nil {
		t.Fatal(err)
	}
	cli := NewGpgCLI(GpgCLIArg{})
	if err := cli.Configure(); err != nil {
		t.Fatal(err)
	}
	index, _, err := cli.Index(true, "")
	if err != nil {
		t.Fatal(err)
	}
	fps := index.AllFingerprints()
	if len(fps) != 1 {
		t.Fatalf("num fingerprints: %d, expected 1", len(fps))
	}
	bundle, err := cli.ImportKey(true, fps[0])
	if err != nil {
		t.Fatal(err)
	}
	if bundle == nil {
		t.Fatal("nil bundle")
	}
	if !bundle.HasSecretKey() {
		t.Fatal("bundle doesn't have secret key")
	}
	if !bundle.CanSign() {
		t.Fatal("bundle can't sign")
	}
}
