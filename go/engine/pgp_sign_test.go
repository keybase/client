package engine

import (
	"bytes"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"io/ioutil"
	"testing"
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
		Opts: keybase_1.PgpSignOptions{
			Mode: keybase_1.SignMode_ATTACHED,
		},
	}

	eng := NewPGPSignEngine(&earg)
	ctx := Context{
		SecretUI: fu.NewSecretUI(),
	}

	err = RunEngine(eng, &ctx, nil, nil)
	if err != nil {
		t.Fatal(err)
	}

	sig := sink.String()

	_, err = key.Verify(sig, []byte(msg))
	if err != nil {
		t.Fatal(err)
	}

}
