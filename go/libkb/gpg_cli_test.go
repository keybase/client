// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"path/filepath"
	"testing"
)

func TestGPGKeyring(t *testing.T) {
	tc := SetupTest(t, "gpg_cli", 1)
	defer tc.Cleanup()
	err := tc.GenerateGPGKeyring("no@no.no")
	if err != nil {
		t.Fatal(err)
	}

	for _, fn := range []string{"secring.gpg", "pubring.gpg"} {
		p := filepath.Join(tc.Tp.GPGHome, fn)
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
	tc := SetupTest(t, "gpg_cli", 1)
	defer tc.Cleanup()
	if err := tc.GenerateGPGKeyring("no@no.no"); err != nil {
		t.Fatal(err)
	}
	cli := NewGpgCLI(tc.G, nil)
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
	bundle, err := cli.ImportKey(true, fps[0], "")
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

// Useful to track down signing errors in GPG < 2.0.29
func TestGPGSign(t *testing.T) {
	t.Skip("skipping GPG Sign test")
	tc := SetupTest(t, "gpg_cli", 1)
	defer tc.Cleanup()
	err := tc.GenerateGPGKeyring("no@no.no")
	if err != nil {
		t.Fatal(err)
	}
	cli := NewGpgCLI(tc.G, nil)
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
	fp := fps[0]

	for i := 0; i < 1000; i++ {
		_, err = cli.Sign(fp, []byte("hello"))
		if err != nil {
			t.Fatal(err)
		}
	}
}
