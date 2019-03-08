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
	err = handler.PassphraseCheck(ctx, keybase1.PassphraseCheckArg{
		Passphrase: fu.Passphrase,
	})
	require.NoError(t, err)

	err = handler.PassphraseCheck(ctx, keybase1.PassphraseCheckArg{
		Passphrase: fu.Passphrase + " ",
	})
	require.Error(t, err)
}
