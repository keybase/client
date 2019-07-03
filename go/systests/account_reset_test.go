package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func assertResetBadgeState(t *testing.T, user *userPlusDevice, expectedDaysLeft int) {
	g := user.tc.G
	user.kickAutoresetd()
	pollForTrue(t, g, func(i int) bool {
		badges := getBadgeState(t, user)
		g.Log.Debug("Iter loop %d badge state: %+v", i, badges)
		if expectedDaysLeft > 0 {
			daysLeft := int(badges.ResetState.EndTime.Time().Sub(time.Now()) / (time.Hour * 24))
			return expectedDaysLeft == int(daysLeft)
		}
		return badges.ResetState.EndTime == 0
	})
}

func processReset(tc libkb.TestContext) error {
	mctx := libkb.NewMetaContextForTest(tc)
	_, err := tc.G.API.Post(mctx, libkb.APIArg{
		Endpoint:    "autoreset/process_dev",
		SessionType: libkb.APISessionTypeNONE,
		RetryCount:  5,
	})
	return err
}

func TestCancelResetPipeline(t *testing.T) {
	t.Skip()

	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	tc := ann.tc
	uis := libkb.UIs{
		LoginUI:  &libkb.TestLoginUI{Username: ann.username},
		SecretUI: ann.newSecretUI(),
	}
	mctx := libkb.NewMetaContextForTest(*tc).WithUIs(uis)
	assertResetBadgeState(t, ann, 0)

	// fails if the user is not in the pipeline
	err := libkb.CancelResetPipeline(mctx)
	require.Error(t, err)
	serr, ok := err.(libkb.AppStatusError)
	require.True(t, ok)
	require.Equal(t, libkb.SCNotFound, serr.Code)
	assertResetBadgeState(t, ann, 0)

	// fails since we are logged in with a provisioned device
	eng := engine.NewAccountReset(tc.G, ann.username)
	err = engine.RunEngine2(mctx, eng)
	require.Error(t, err)
	require.IsType(t, libkb.ResetWithActiveDeviceError{}, err)

	// succeeds and is then canceled
	ann.logout()
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)

	ann.login()
	assertResetBadgeState(t, ann, 2)
	err = libkb.CancelResetPipeline(mctx)
	require.NoError(t, err)
	require.NoError(t, processReset(*tc))
	assertResetBadgeState(t, ann, 0)

	// succeed without a session
	ann.logout()
	uis = libkb.UIs{
		LoginUI:  &libkb.TestLoginUI{Username: ann.username},
		SecretUI: &libkb.TestSecretUI{},
	}
	mctx = libkb.NewMetaContextForTest(*tc).WithUIs(uis)
	eng = engine.NewAccountReset(tc.G, ann.username)
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)

	ann.login()
	// We don't have any badges since the countdown does not start until the
	// user verifies via email.
	assertResetBadgeState(t, ann, 0)

	err = libkb.CancelResetPipeline(mctx)
	require.NoError(t, err)
	assertResetBadgeState(t, ann, 0)

	// fail without a session
	ann.logout()
	uis = libkb.UIs{
		LoginUI:  &libkb.TestLoginUI{Username: ann.username},
		SecretUI: &libkb.TestSecretUI{},
	}
	mctx = libkb.NewMetaContextForTest(*tc).WithUIs(uis)
	eng = engine.NewAccountReset(tc.G, "")
	err = engine.RunEngine2(mctx, eng)
	require.Error(t, err)
	t.Logf("err: %v", err)
	require.IsType(t, libkb.ResetMissingParamsError{}, err)
}
