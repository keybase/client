package engine

import (
	"bytes"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp"
)

// give a private key and a public key, test the encryption of a
// message
func TestPGPEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_encrypt")
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
	var sink bytes.Buffer
	arg := &PGPEncryptArg{
		Sink:       &sink,
		Source:     strings.NewReader(msg),
		Signer:     bundleSrc,
		Recipients: []*libkb.PgpKeyBundle{bundleSrc, bundleDst},
	}
	eng := NewPGPEncrypt(arg)
	ctx := &Context{}
	if err := RunEngine(eng, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}
	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}

	// check that each recipient can read the message
	for _, recip := range arg.Recipients {
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
