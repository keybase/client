// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGPGKeyring(t *testing.T) {
	tc := SetupTest(t, "gpg_cli", 1)
	defer tc.Cleanup()
	err := tc.GenerateGPGKeyring("no@no.no")
	require.NoError(t, err)

	for _, fn := range []string{"secring.gpg", "pubring.gpg"} {
		p := filepath.Join(tc.Tp.GPGHome, fn)
		ok, err := FileExists(p)
		require.NoError(t, err)
		require.True(t, ok, "file not found: %s", p)
	}
}

func TestGPGImportSecret(t *testing.T) {
	tc := SetupTest(t, "gpg_cli", 1)
	defer tc.Cleanup()
	if err := tc.GenerateGPGKeyring("no@no.no"); err != nil {
		require.NoError(t, err)
	}
	cli := NewGpgCLI(tc.G, nil)
	if err := cli.Configure(tc.MetaContext()); err != nil {
		require.NoError(t, err)
	}
	index, _, err := cli.Index(tc.MetaContext(), true, "")
	require.NoError(t, err)
	fps := index.AllFingerprints()
	require.Len(t, fps, 1, "num fingerprints: %d, expected 1", len(fps))
	bundle, err := cli.ImportKey(tc.MetaContext(), true, fps[0], "")
	require.NoError(t, err)
	require.NotNil(t, bundle,
		"nil bundle")
	require.True(t, bundle.HasSecretKey(),
		"bundle doesn't have secret key")
	require.True(t, bundle.CanSign(),
		"bundle can't sign")
}

// Useful to track down signing errors in GPG < 2.0.29
func TestGPGSign(t *testing.T) {
	t.Skip("skipping GPG Sign test")
	tc := SetupTest(t, "gpg_cli", 1)
	defer tc.Cleanup()
	err := tc.GenerateGPGKeyring("no@no.no")
	require.NoError(t, err)
	cli := NewGpgCLI(tc.G, nil)
	if err := cli.Configure(tc.MetaContext()); err != nil {
		require.NoError(t, err)
	}
	index, _, err := cli.Index(tc.MetaContext(), true, "")
	require.NoError(t, err)
	fps := index.AllFingerprints()
	require.Len(t, fps, 1, "num fingerprints: %d, expected 1", len(fps))
	fp := fps[0]

	for range 1000 {
		_, err = cli.Sign(tc.MetaContext(), fp, []byte("hello"))
		require.NoError(t, err)
	}
}
