// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPGPDecryptBasic(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	keyA, err := tc.MakePGPKey("keya@keybase.io")
	require.NoError(t, err)
	keyB, err := tc.MakePGPKey("keyb@keybase.io")
	require.NoError(t, err)

	mid := NewBufferCloser()
	msg := "Is it time for lunch?"
	recipients := []*PGPKeyBundle{keyA, keyB}
	if err := PGPEncrypt(strings.NewReader(msg), mid, nil, recipients); err != nil {
		require.NoError(t, err)
	}

	out := NewBufferCloser()
	if _, err := PGPDecryptWithBundles(tc.G, mid, out, recipients); err != nil {
		require.NoError(t, err)
	}

	dec := out.String()
	require.Equal(t, msg, dec, "decoded: %q, expected %q", dec, msg)
}
