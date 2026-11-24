// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// loginPostAPI answers each login POST with the next scripted reply: a status
// code for the server to return, or an error for the call itself.
type loginPostAPI struct {
	FakeAPI
	replies []any
}

func (a *loginPostAPI) PostDecode(_ MetaContext, _ APIArg, v APIResponseWrapper) error {
	if len(a.replies) == 0 {
		return errors.New("no scripted login reply")
	}
	reply := a.replies[0]
	a.replies = a.replies[1:]
	switch r := reply.(type) {
	case error:
		return r
	case int:
		v.GetAppStatus().Code = r
	}
	return nil
}

type recordingSecretUI struct {
	args []keybase1.GUIEntryArg
}

func (u *recordingSecretUI) GetPassphrase(p keybase1.GUIEntryArg, _ *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	u.args = append(u.args, p)
	return keybase1.GetPassphraseRes{Passphrase: "testpassphrase"}, nil
}

func promptLoopRetryArgs(t *testing.T, firstReply any) []keybase1.GUIEntryArg {
	tc := SetupTest(t, "ppl_prompt_loop", 1)
	defer tc.Cleanup()
	tc.G.API = &FakeAPI{}
	m := NewMetaContextForTest(tc)
	ls := NewLoginSession(tc.G, "testuser")
	require.NoError(t, ls.Load(m))

	tc.G.API = &loginPostAPI{replies: []any{firstReply, errors.New("stop")}}
	ui := &recordingSecretUI{}
	m = m.WithNewProvisionalLoginContext().WithUIs(UIs{SecretUI: ui})
	err := pplPromptLoop(m, 2, ls, keybase1.GUIEntryArg{Username: "testuser"})
	require.EqualError(t, err, "stop")
	require.Len(t, ui.args, 2)
	require.False(t, ui.args[0].RetryBadPassword)
	return ui.args
}

func TestPromptLoopMarksServerRejectedPassword(t *testing.T) {
	args := promptLoopRetryArgs(t, SCBadLoginPassword)
	require.True(t, args[1].RetryBadPassword)
	require.Equal(t, errServerRejectedPassword.Error(), args[1].RetryLabel)
}

func TestPromptLoopOtherPassphraseErrorIsNotBadPassword(t *testing.T) {
	other := PassphraseError{"failed to open secretbox"}
	args := promptLoopRetryArgs(t, other)
	require.False(t, args[1].RetryBadPassword)
	require.Equal(t, other.Error(), args[1].RetryLabel)
}
