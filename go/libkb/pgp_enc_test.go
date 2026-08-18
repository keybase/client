// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"crypto/rand"
	"io"
	"strings"
	"testing"
	"testing/quick"

	"github.com/keybase/go-crypto/openpgp"
	"github.com/stretchr/testify/require"
)

// give a private key and a public key, test the encryption of a
// message
func TestPGPEncrypt(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	bundleSrc, err := tc.MakePGPKey("src@keybase.io")
	require.NoError(t, err)
	bundleDst, err := tc.MakePGPKey("dst@keybase.io")
	require.NoError(t, err)

	msg := "59 seconds"
	sink := NewBufferCloser()
	recipients := []*PGPKeyBundle{bundleSrc, bundleDst}
	if err := PGPEncrypt(strings.NewReader(msg), sink, bundleSrc, recipients); err != nil {
		require.NoError(t, err)
	}
	out := sink.Bytes()
	require.NotEmpty(t, out, "no output")

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{recip.Entity}
		emsg := bytes.NewBuffer(out)
		md, err := openpgp.ReadMessage(emsg, kr, nil, nil)
		require.NoError(t, err)
		text, err := io.ReadAll(md.UnverifiedBody)
		require.NoError(t, err)
		require.Equal(t, msg, string(text), "message: %q, expected %q", string(text), msg)
	}
}

func TestPGPEncryptString(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	bundleSrc, err := tc.MakePGPKey("src@keybase.io")
	require.NoError(t, err)
	bundleDst, err := tc.MakePGPKey("dst@keybase.io")
	require.NoError(t, err)

	msg := "59 seconds"
	recipients := []*PGPKeyBundle{bundleSrc, bundleDst}
	out, err := PGPEncryptString(msg, bundleSrc, recipients)
	require.NoError(t, err)

	require.NotEmpty(t, out, "no output")

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{recip.Entity}
		emsg := bytes.NewBuffer(out)
		md, err := openpgp.ReadMessage(emsg, kr, nil, nil)
		require.NoError(t, err)
		text, err := io.ReadAll(md.UnverifiedBody)
		require.NoError(t, err)
		require.Equal(t, msg, string(text), "message: %q, expected %q", string(text), msg)
	}
}

func TestPGPEncryptQuick(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	bundleSrc, err := tc.MakePGPKey("src@keybase.io")
	require.NoError(t, err)
	bundleDst, err := tc.MakePGPKey("dst@keybase.io")
	require.NoError(t, err)

	f := func(msg []byte) bool {
		sink := NewBufferCloser()
		recipients := []*PGPKeyBundle{bundleSrc, bundleDst}
		if err := PGPEncrypt(bytes.NewReader(msg), sink, bundleSrc, recipients); err != nil {
			return false
		}
		out := sink.Bytes()
		if len(out) == 0 {
			return false
		}

		// check that each recipient can read the message
		for _, recip := range recipients {
			kr := openpgp.EntityList{recip.Entity}
			emsg := bytes.NewBuffer(out)
			md, err := openpgp.ReadMessage(emsg, kr, nil, nil)
			if err != nil {
				return false
			}
			data, err := io.ReadAll(md.UnverifiedBody)
			if err != nil {
				return false
			}
			if !bytes.Equal(data, msg) {
				return false
			}
		}
		return true
	}

	err = quick.Check(f, nil)
	require.NoError(t, err)
}

func TestPGPEncryptLong(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	bundleSrc, err := tc.MakePGPKey("src@keybase.io")
	require.NoError(t, err)
	bundleDst, err := tc.MakePGPKey("dst@keybase.io")
	require.NoError(t, err)

	msg := make([]byte, 1024*1024)

	_, err = rand.Read(msg)
	require.NoError(t, err)

	tc.G.Log.Info("msg size: %d", len(msg))

	sink := NewBufferCloser()
	recipients := []*PGPKeyBundle{bundleSrc, bundleDst}
	if err := PGPEncrypt(bytes.NewReader(msg), sink, bundleSrc, recipients); err != nil {
		require.NoError(t, err)
	}

	out := sink.Bytes()
	require.NotEmpty(t, out, "no output")

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{recip.Entity}
		emsg := bytes.NewBuffer(out)
		md, err := openpgp.ReadMessage(emsg, kr, nil, nil)
		require.NoError(t, err)
		text, err := io.ReadAll(md.UnverifiedBody)
		require.NoError(t, err)
		require.Equal(t, string(msg), string(text), "message: %q, expected %q", string(text), string(msg))
	}
}
