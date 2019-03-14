// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestPassphraseChange(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseChange")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")

	arg := &keybase1.PassphraseCheckArg{}
	secretUI := u.NewSecretUI()
	uis := libkb.UIs{
		SecretUI: secretUI,
	}
	eng := NewPassphraseCheck(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := eng.Run(m)
	require.NoError(t, err)
	require.True(t, eng.GetResult())

	secretUI.Passphrase += " "
	err = eng.Run(m)
	require.NoError(t, err)
	require.False(t, eng.GetResult())

	// Without SecretUI and without passphrase argument.
	m = NewMetaContextForTest(tc)
	err = eng.Run(m)
	require.Error(t, err)

	// Pass passphrase in arg
	arg.Passphrase = u.Passphrase
	eng = NewPassphraseCheck(tc.G, arg)
	err = eng.Run(m)
	require.NoError(t, err)
	require.True(t, eng.GetResult())

	arg.Passphrase = u.Passphrase + " "
	eng = NewPassphraseCheck(tc.G, arg)
	err = eng.Run(m)
	require.NoError(t, err)
	require.False(t, eng.GetResult())
}
