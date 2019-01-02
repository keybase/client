package service

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestSignupRandomPWUser(t *testing.T) {
	tc := libkb.SetupTest(t, "randompw", 3)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUserRandomPW("rpw", tc.G)
	require.NoError(t, err)
	_ = user

	handler := NewLoginHandler(nil, tc.G)
	err = handler.Logout(context.Background(), keybase1.LogoutArg{})
	require.Error(t, err)
	require.Contains(t, err.Error(), "Cannot logout")
	require.Contains(t, err.Error(), "Set a password first")

	err = handler.Logout(context.Background(), keybase1.LogoutArg{Force: true})
	require.NoError(t, err)
}
