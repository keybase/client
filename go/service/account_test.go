package service

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestCheckPassphrase(t *testing.T) {
	tc := libkb.SetupTest(t, "pche", 3)
	defer tc.Cleanup()

	fu, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()
	ret, err := handler.PassphraseCheck(ctx, keybase1.PassphraseCheckArg{
		Passphrase: fu.Passphrase,
	})
	require.NoError(t, err)
	require.True(t, ret)

	// Bad passphrase should come back as ret=false and no error.
	ret, err = handler.PassphraseCheck(ctx, keybase1.PassphraseCheckArg{
		Passphrase: fu.Passphrase + " ",
	})
	require.NoError(t, err)
	require.False(t, ret)

	// Other errors should come back as errors.
	kbtest.Logout(tc)
	ret, err = handler.PassphraseCheck(ctx, keybase1.PassphraseCheckArg{
		Passphrase: fu.Passphrase + " ",
	})
	require.Error(t, err)
}

func TestRecoverUsername(t *testing.T) {
	tc := libkb.SetupTest(t, "recu", 3)
	defer tc.Cleanup()

	fu, err := kbtest.CreateAndSignupFakeUser("rcu", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()

	// We are not going to check if the email was sent, but we
	// are testing if we can call this RPC on both logged and
	// unlogged session.

	err = handler.RecoverUsername(ctx, keybase1.RecoverUsernameArg{
		Email: fu.Email,
	})
	require.NoError(t, err)

	kbtest.Logout(tc)

	err = handler.RecoverUsername(ctx, keybase1.RecoverUsernameArg{
		Email: fu.Email,
	})
	require.NoError(t, err)

	err = handler.RecoverUsername(ctx, keybase1.RecoverUsernameArg{
		Email: "bad+" + fu.Email,
	})
	require.Error(t, err)
}
