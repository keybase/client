// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"io"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
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
	fu := createFakeUserWithPGPSibkeyPushed(tc)

	if err := fu.LoadUser(tc); err != nil {
		require.NoError(t, err)
	}

	require.NotNil(t, fu.User,
		"got a nil User")

	m := libkb.NewMetaContextForTest(tc)

	skb, err := fu.User.GetSyncedSecretKey(m)
	require.NoError(t, err)

	require.NotNil(t, skb,
		"skb is nil")

	key, err := skb.GetPubKey()
	require.NoError(t, err)

	for _, test := range signTests {
		var sink bytes.Buffer

		earg := PGPSignArg{
			Sink:   libkb.NopWriteCloser{W: &sink},
			Source: io.NopCloser(bytes.NewBufferString(test.input)),
			Opts: keybase1.PGPSignOptions{
				Mode: keybase1.SignMode_ATTACHED,
			},
		}

		eng := NewPGPSignEngine(tc.G, &earg)
		uis := libkb.UIs{
			PgpUI:    &TestPgpUI{},
			SecretUI: fu.NewSecretUI(),
		}

		m := NewMetaContextForTest(tc).WithUIs(uis)
		err = RunEngine2(m, eng)
		require.NoError(t, err, "%s: run error: %s", test.name, err)

		sig := sink.String()

		_, err = key.VerifyString(tc.G.Log, sig, []byte(test.input))
		require.NoError(t, err, "%s: verify error: %s", test.name, err)
	}
}
