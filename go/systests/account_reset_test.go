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

func TestCancelResetPipeline(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	tc := ann.tc

	assertResetBadgeState(t, ann, 0)

	mctx := libkb.NewMetaContextForTest(*tc)
	// fails if the user is not in the pipeline
	err := libkb.CancelResetPipeline(mctx)
	require.Error(t, err)
	serr, ok := err.(libkb.AppStatusError)
	require.True(t, ok)
	require.Equal(t, libkb.SCNotFound, serr.Code)
	assertResetBadgeState(t, ann, 0)

	// succeeds and is then canceled
	eng := engine.NewAccountReset(tc.G, ann.username, "")
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)
	assertResetBadgeState(t, ann, 2)
	err = libkb.CancelResetPipeline(mctx)
	require.NoError(t, err)
	assertResetBadgeState(t, ann, 0)

	eng = engine.NewAccountReset(tc.G, ann.username, "")
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)
	assertResetBadgeState(t, ann, 2)
}
