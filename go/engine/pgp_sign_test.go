// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"io/ioutil"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type signTest struct {
	name  string
	input string
}

var signTests = []signTest{
	{name: "john hancock", input: "When in the Course of human events, it becomes necessary for one people to dissolve the political bands"},
	{name: "empty", input: ""},
}

// Test pgp sign attached.
func TestPGPSign(t *testing.T) {
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

	for _, test := range signTests {
		var sink bytes.Buffer

		earg := PGPSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: ioutil.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.PGPSignOptions{
				Mode: keybase1.SignMode_ATTACHED,
			},
		}

		eng := NewPGPSignEngine(&earg, tc.G)
		ctx := Context{
			SecretUI: fu.NewSecretUI(),
		}

		err = RunEngine(eng, &ctx)
		if err != nil {
			t.Errorf("%s: run error: %s", test.name, err)
			continue
		}

		sig := sink.String()

		_, err = key.VerifyString(tc.G.Log, sig, []byte(test.input))
		if err != nil {
			t.Errorf("%s: verify error: %s", test.name, err)
			continue
		}
	}
}
