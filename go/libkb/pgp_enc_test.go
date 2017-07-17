// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"crypto/rand"
	"io/ioutil"
	"strings"
	"testing"
	"testing/quick"

	"github.com/keybase/go-crypto/openpgp"
)

// give a private key and a public key, test the encryption of a
// message
func TestPGPEncrypt(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	bundleSrc, err := tc.MakePGPKey("src@keybase.io")
	if err != nil {
		t.Fatal(err)
	}
	bundleDst, err := tc.MakePGPKey("dst@keybase.io")
	if err != nil {
		t.Fatal(err)
	}

	msg := "59 seconds"
	sink := NewBufferCloser()
	recipients := []*PGPKeyBundle{bundleSrc, bundleDst}
	if err := PGPEncrypt(strings.NewReader(msg), sink, bundleSrc, recipients); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{recip.Entity}
		emsg := bytes.NewBuffer(out)
		md, err := openpgp.ReadMessage(emsg, kr, nil, nil)
		if err != nil {
			t.Fatal(err)
		}
		text, err := ioutil.ReadAll(md.UnverifiedBody)
		if err != nil {
			t.Fatal(err)
		}
		if string(text) != msg {
			t.Errorf("message: %q, expected %q", string(text), msg)
		}
	}
}

func TestPGPEncryptString(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	bundleSrc, err := tc.MakePGPKey("src@keybase.io")
	if err != nil {
		t.Fatal(err)
	}
	bundleDst, err := tc.MakePGPKey("dst@keybase.io")
	if err != nil {
		t.Fatal(err)
	}

	msg := "59 seconds"
	recipients := []*PGPKeyBundle{bundleSrc, bundleDst}
	out, err := PGPEncryptString(msg, bundleSrc, recipients)
	if err != nil {
		t.Fatal(err)
	}

	if len(out) == 0 {
		t.Fatal("no output")
	}

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{recip.Entity}
		emsg := bytes.NewBuffer(out)
		md, err := openpgp.ReadMessage(emsg, kr, nil, nil)
		if err != nil {
			t.Fatal(err)
		}
		text, err := ioutil.ReadAll(md.UnverifiedBody)
		if err != nil {
			t.Fatal(err)
		}
		if string(text) != msg {
			t.Errorf("message: %q, expected %q", string(text), msg)
		}
	}
}

func TestPGPEncryptQuick(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	bundleSrc, err := tc.MakePGPKey("src@keybase.io")
	if err != nil {
		t.Fatal(err)
	}
	bundleDst, err := tc.MakePGPKey("dst@keybase.io")
	if err != nil {
		t.Fatal(err)
	}

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
			data, err := ioutil.ReadAll(md.UnverifiedBody)
			if err != nil {
				return false
			}
			if !bytes.Equal(data, msg) {
				return false
			}
		}
		return true
	}

	if err := quick.Check(f, nil); err != nil {
		t.Error(err)
	}
}

func TestPGPEncryptLong(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt", 1)
	defer tc.Cleanup()
	bundleSrc, err := tc.MakePGPKey("src@keybase.io")
	if err != nil {
		t.Fatal(err)
	}
	bundleDst, err := tc.MakePGPKey("dst@keybase.io")
	if err != nil {
		t.Fatal(err)
	}

	msg := make([]byte, 1024*1024)

	rand.Read(msg)

	G.Log.Info("msg size: %d", len(msg))

	sink := NewBufferCloser()
	recipients := []*PGPKeyBundle{bundleSrc, bundleDst}
	if err := PGPEncrypt(bytes.NewReader(msg), sink, bundleSrc, recipients); err != nil {
		t.Fatal(err)
	}

	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{recip.Entity}
		emsg := bytes.NewBuffer(out)
		md, err := openpgp.ReadMessage(emsg, kr, nil, nil)
		if err != nil {
			t.Fatal(err)
		}
		text, err := ioutil.ReadAll(md.UnverifiedBody)
		if err != nil {
			t.Fatal(err)
		}
		if string(text) != string(msg) {
			t.Errorf("message: %q, expected %q", string(text), string(msg))
		}
	}
}
