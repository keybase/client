package libkb

import (
	"bytes"
	"io/ioutil"
	"os"
	"strings"
	"testing"
	"testing/quick"

	"golang.org/x/crypto/openpgp"
)

// give a private key and a public key, test the encryption of a
// message
func TestPGPEncrypt(t *testing.T) {
	tc := SetupTest(t, "pgp_encrypt")
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
	recipients := []*PgpKeyBundle{bundleSrc, bundleDst}
	if err := PGPEncrypt(strings.NewReader(msg), sink, bundleSrc, recipients); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{(*openpgp.Entity)(recip)}
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
	tc := SetupTest(t, "pgp_encrypt")
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
	recipients := []*PgpKeyBundle{bundleSrc, bundleDst}
	out, err := PGPEncryptString(msg, bundleSrc, recipients)
	if err != nil {
		t.Fatal(err)
	}

	if len(out) == 0 {
		t.Fatal("no output")
	}

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{(*openpgp.Entity)(recip)}
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
	tc := SetupTest(t, "pgp_encrypt")
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
		recipients := []*PgpKeyBundle{bundleSrc, bundleDst}
		if err := PGPEncrypt(bytes.NewReader(msg), sink, bundleSrc, recipients); err != nil {
			return false
		}
		out := sink.Bytes()
		if len(out) == 0 {
			return false
		}

		// check that each recipient can read the message
		for _, recip := range recipients {
			kr := openpgp.EntityList{(*openpgp.Entity)(recip)}
			emsg := bytes.NewBuffer(out)
			md, err := openpgp.ReadMessage(emsg, kr, nil, nil)
			if err != nil {
				return false
			}
			data, err := ioutil.ReadAll(md.UnverifiedBody)
			if err != nil {
				return false
			}
			if bytes.Compare(data, msg) != 0 {
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
	tc := SetupTest(t, "pgp_encrypt")
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
	f, err := os.Open("/dev/urandom")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	f.Read(msg)

	G.Log.Info("msg size: %d", len(msg))

	sink := NewBufferCloser()
	recipients := []*PgpKeyBundle{bundleSrc, bundleDst}
	if err := PGPEncrypt(bytes.NewReader(msg), sink, bundleSrc, recipients); err != nil {
		t.Fatal(err)
	}

	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	// check that each recipient can read the message
	for _, recip := range recipients {
		kr := openpgp.EntityList{(*openpgp.Entity)(recip)}
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
