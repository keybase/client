package engine

import (
	"bytes"
	"io/ioutil"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// Test login switching between two different users.
func TestPgpSign(t *testing.T) {
	tc := SetupEngineTest(t, "pgp_sign")
	defer tc.Cleanup()
	fu := createFakeUserWithPGPOnly(t, tc)

	skb, err := fu.User.GetSyncedSecretKey()
	if err != nil {
		t.Fatal(err)
	}

	if skb == nil {
		t.Fatalf("skb is nil")
	}

	key, err := skb.GetPubKey()
	if err != nil {
		t.Fatal(err)
	}

	var sink bytes.Buffer

	// Put your John Hancock on this!
	msg := "When in the Course of human events, it becomes necessary for one people to dissolve the political bands"

	earg := PGPSignArg{
		Sink:   libkb.NopWriteCloser{W: &sink},
		Source: ioutil.NopCloser(bytes.NewBufferString(msg)),
		Opts: keybase1.PgpSignOptions{
			Mode: keybase1.SignMode_ATTACHED,
		},
	}

	eng := NewPGPSignEngine(&earg, tc.G)
	ctx := Context{
		SecretUI: fu.NewSecretUI(),
	}

	err = RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}

	sig := sink.String()

	_, err = key.Verify(sig, []byte(msg))
	if err != nil {
		t.Fatal(err)
	}

}
