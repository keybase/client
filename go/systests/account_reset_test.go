package systests

import (
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func assertResetBadgeState(t *testing.T, user *userPlusDevice, expectReset bool) {
	g := user.tc.G
	user.kickAutoresetd()
	pollForTrue(t, g, func(i int) bool {
		badges := getBadgeState(t, user)
		g.Log.Debug("Iter loop %d badge state: %+v", i, badges)
		if expectReset {
			return badges.ResetInProgressMessage != ""
		}
		return badges.ResetInProgressMessage == ""
	})

}

func TestCancelResetPipeline(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	tc := ann.tc

	assertResetBadgeState(t, ann, false)

	mctx := libkb.NewMetaContextForTest(*tc)
	// fails if the user is not in the pipeline
	err := libkb.CancelResetPipeline(mctx)
	require.Error(t, err)
	serr, ok := err.(libkb.AppStatusError)
	require.True(t, ok)
	require.Equal(t, libkb.SCNotFound, serr.Code)
	assertResetBadgeState(t, ann, false)

	// succeeds and is then canceled
	eng := engine.NewAccountReset(tc.G, ann.username, "")
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)
	assertResetBadgeState(t, ann, true)
	err = libkb.CancelResetPipeline(mctx)
	require.NoError(t, err)
	assertResetBadgeState(t, ann, false)

	eng = engine.NewAccountReset(tc.G, ann.username, "")
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)
	assertResetBadgeState(t, ann, true)
}
