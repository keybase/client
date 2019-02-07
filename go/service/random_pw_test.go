package service

import (
	"errors"
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func sessCheck(t *testing.T, g *libkb.GlobalContext) (err error) {
	arg := libkb.NewRetryAPIArg("sesscheck")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	_, err = g.API.Get(arg)
	t.Logf("sesscheck returned: %q", err)
	return err
}

func setPassphraseInTest(tc libkb.TestContext) error {
	newPassphrase := "okokokok"
	arg := &keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      true,
	}
	uis := libkb.UIs{
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := engine.NewPassphraseChange(tc.G, arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func TestSignupRandomPWUser(t *testing.T) {
	tc := libkb.SetupTest(t, "randompw", 3)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUserRandomPW("rpw", tc.G)
	require.NoError(t, err)

	userHandler := NewUserHandler(nil, tc.G, nil)
	ret, err := userHandler.LoadHasRandomPw(context.Background(), keybase1.LoadHasRandomPwArg{})
	require.NoError(t, err)
	require.True(t, ret)

	// Another call to test the caching
	ret, err = userHandler.LoadHasRandomPw(context.Background(), keybase1.LoadHasRandomPwArg{})
	require.NoError(t, err)
	require.True(t, ret)

	// Another one with ForceRepoll
	ret, err = userHandler.LoadHasRandomPw(context.Background(), keybase1.LoadHasRandomPwArg{ForceRepoll: true})
	require.NoError(t, err)
	require.True(t, ret)

	ret2, err := userHandler.CanLogout(context.Background(), 0)
	require.NoError(t, err)
	require.False(t, ret2.CanLogout)
	require.NotEmpty(t, ret2.Reason)

	// Set passphrase
	err = setPassphraseInTest(tc)
	require.NoError(t, err)

	ret2, err = userHandler.CanLogout(context.Background(), 0)
	require.NoError(t, err)
	require.True(t, ret2.CanLogout)
	require.Empty(t, ret2.Reason)
}

type errorAPIMock struct {
	*libkb.APIArgRecorder
	realAPI       libkb.API
	callCount     int
	shouldTimeout bool
}

func (r *errorAPIMock) GetDecode(arg libkb.APIArg, w libkb.APIResponseWrapper) error {
	if arg.Endpoint == "user/has_random_pw" {
		r.callCount++
		if r.shouldTimeout {
			return errors.New("timeout or something")
		}
	}
	return r.realAPI.GetDecode(arg, w)
}

func TestCanLogoutTimeout(t *testing.T) {
	tc := libkb.SetupTest(t, "randompw", 3)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUserRandomPW("rpw", tc.G)
	require.NoError(t, err)

	realAPI := tc.G.API
	fakeAPI := &errorAPIMock{
		realAPI:       realAPI,
		shouldTimeout: true,
	}
	tc.G.API = fakeAPI

	userHandler := NewUserHandler(nil, tc.G, nil)

	// It will fail with an error and Frontend would still send user
	// to passphrase screen.
	ret2, err := userHandler.CanLogout(context.Background(), 0)
	require.NoError(t, err)
	require.False(t, ret2.CanLogout)
	require.Contains(t, ret2.Reason, "Cannot check user state")
	require.Equal(t, 1, fakeAPI.callCount)

	// Switch off the timeouting for one call
	fakeAPI.shouldTimeout = false

	// Call this again, should still fail, but after making actual call to API.
	ret2, err = userHandler.CanLogout(context.Background(), 0)
	require.NoError(t, err)
	require.False(t, ret2.CanLogout)
	require.Contains(t, ret2.Reason, "set a password first")
	require.Equal(t, 2, fakeAPI.callCount)

	// Back to "offline" state.
	fakeAPI.shouldTimeout = true

	// Now it should try to do an API call, fail to do so, but get
	// the cached value and derive that the passphrase is not set.
	ret2, err = userHandler.CanLogout(context.Background(), 0)
	require.NoError(t, err)
	require.False(t, ret2.CanLogout)
	require.Contains(t, ret2.Reason, "set a password first")
	require.Equal(t, 3, fakeAPI.callCount)

	// Back to real API because we are going to change passphrase.
	tc.G.API = realAPI

	err = setPassphraseInTest(tc)
	require.NoError(t, err)

	// Call this again with real API, we should be clear to logout
	// and the value should be cached.
	ret2, err = userHandler.CanLogout(context.Background(), 0)
	require.NoError(t, err)
	require.True(t, ret2.CanLogout)

	// Switch to fake API, but on-line, reset call count.
	tc.G.API = fakeAPI
	fakeAPI.shouldTimeout = false
	fakeAPI.callCount = 0

	// Next try should not call API at all, just use the cached value.
	ret2, err = userHandler.CanLogout(context.Background(), 0)
	require.NoError(t, err)
	require.True(t, ret2.CanLogout)
	require.Equal(t, 0, fakeAPI.callCount)

	// Same with timeouting API.
	fakeAPI.shouldTimeout = true

	ret2, err = userHandler.CanLogout(context.Background(), 0)
	require.NoError(t, err)
	require.True(t, ret2.CanLogout)
	require.Equal(t, 0, fakeAPI.callCount) // still 0 calls.

	// Until we try to force repoll
	_, err = userHandler.LoadHasRandomPw(context.Background(), keybase1.LoadHasRandomPwArg{
		ForceRepoll: true,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "timeout or something")
	require.Equal(t, 1, fakeAPI.callCount)
}
