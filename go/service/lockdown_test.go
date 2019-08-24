package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestLockdownAPI(t *testing.T) {
	tc := libkb.SetupTest(t, "lockdown", 3)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()
	res, err := handler.GetLockdownMode(ctx, 0)
	require.NoError(t, err)
	require.False(t, res.Status)
	require.Len(t, res.History, 0)

	err = handler.SetLockdownMode(ctx, keybase1.SetLockdownModeArg{
		Enabled: true,
	})
	require.NoError(t, err)

	res, err = handler.GetLockdownMode(ctx, 0)
	require.NoError(t, err)
	require.True(t, res.Status)
	require.Len(t, res.History, 1)

	require.True(t, res.History[0].Status)
}

func TestLockdownReset(t *testing.T) {
	// See if we can still reset in lockdown mode.
	// We should be able to!
	tc := libkb.SetupTest(t, "lockdown", 3)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()

	err = handler.SetLockdownMode(ctx, keybase1.SetLockdownModeArg{
		Enabled: true,
	})
	require.NoError(t, err)

	res, err := handler.GetLockdownMode(ctx, 0)
	require.NoError(t, err)
	require.True(t, res.Status)

	err = handler.ResetAccount(ctx, keybase1.ResetAccountArg{
		Passphrase: user.Passphrase,
	})
	require.NoError(t, err)
}

func TestLockdownLogin(t *testing.T) {
	tc := libkb.SetupTest(t, "lockdown", 3)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()

	err = handler.SetLockdownMode(ctx, keybase1.SetLockdownModeArg{
		Enabled: true,
	})
	require.NoError(t, err)

	m := libkb.NewMetaContextForTest(tc)
	_, err = tc.G.ActiveDevice.SyncSecretsForce(m)
	require.NoError(t, err)

	kbtest.Logout(tc)
	err = user.Login(tc.G)
	require.NoError(t, err)
}

func TestLockdownProvisionAndLogin(t *testing.T) {
	tc := libkb.SetupTest(t, "lockdown", 3)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUserPaper("lmu", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()

	err = handler.SetLockdownMode(ctx, keybase1.SetLockdownModeArg{
		Enabled: true,
	})
	require.NoError(t, err)

	tc2 := libkb.SetupTest(t, "lockdown_second", 3)
	defer tc2.Cleanup()
	kbtest.ProvisionNewDeviceKex(&tc, &tc2, user, libkb.DeviceTypeDesktop)

	kbtest.Logout(tc)

	err = user.Login(tc.G)
	require.NoError(t, err)
}
