package engine

import (
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
	"testing"
	"time"
)

func TestNIST(t *testing.T) {
	tc := SetupEngineTest(t, "nist")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "nst")

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	// Need to set active devices
	Logout(tc)

	ctx := context.Background()

	// If you're logged out, it's not an error to grab a NIST,
	// you just won't get one back
	nist, err := tc.G.ActiveDevice.NIST(ctx)
	require.NoError(t, err)
	require.Nil(t, nist)

	fu.LoginOrBust(tc)

	// First stab, generate the NIST, and make sure it's a long NIST
	nist, err = tc.G.ActiveDevice.NIST(ctx)
	require.NoError(t, err, "no nist error")
	require.NotNil(t, nist, "nist came back")
	require.False(t, nist.IsExpired(), "nist is not expired")
	longTok := nist.Token().String()
	require.True(t, len(longTok) > 60, "should be a long token")

	// If we call into the same codepath again, make sure that we get
	// the same NIST back out
	nist, err = tc.G.ActiveDevice.NIST(ctx)
	require.NoError(t, err, "no nist error")
	longTok2 := nist.Token().String()
	require.Equal(t, longTok, longTok2, "same token if done twice")

	// Once we've "marked success" for the NIST, then we're OK to switch over
	// to a "short NIST"
	nist.MarkSuccess()
	nist, err = tc.G.ActiveDevice.NIST(ctx)
	require.NoError(t, err, "no nist error")
	shortTok1 := nist.Token().String()
	require.True(t, len(shortTok1) < 60, "should be a short token")
	require.NotEqual(t, longTok2, shortTok1, "and yes, it's a different token")

	// After 100 hours, it should be an expired token
	fakeClock.Advance(100 * time.Hour)
	require.True(t, nist.IsExpired(), "nist should be expired now")
	nist, err = tc.G.ActiveDevice.NIST(ctx)
	require.NoError(t, err, "no nist error")

	// Easy to make a new token, but we have to make sure that it's
	// a different one.
	longTok3 := nist.Token().String()
	require.True(t, len(longTok3) > 60, "should be a long token")
	require.NotEqual(t, longTok, longTok3, "after expiration, should get a new token")

	// As before, once it's successful, then, as above, we get a short NIST token.
	nist.MarkSuccess()
	nist, err = tc.G.ActiveDevice.NIST(ctx)
	require.NoError(t, err, "no nist error")
	shortTok2 := nist.Token().String()
	require.True(t, len(shortTok2) < 60, "should be a short token")
	require.NotEqual(t, shortTok1, shortTok2, "the short tok changed")
}
