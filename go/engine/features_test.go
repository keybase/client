package engine

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestFeatureFlagSet(t *testing.T) {
	tc := SetupEngineTest(t, "features")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)
	m := NewMetaContextForTest(tc)
	CreateAndSignupFakeUserPaper(tc, "feat")

	testFeature := libkb.Feature("test_feature")

	// enable the feature server side through test endpoint
	_, err := tc.G.API.Post(m, libkb.APIArg{
		Endpoint:    "test/feature",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"feature":   libkb.S{Val: string(testFeature)},
			"value":     libkb.I{Val: 1},
			"cache_sec": libkb.I{Val: 100},
		},
	})
	require.NoError(t, err)

	// check it is on
	on, err := tc.G.FeatureFlags.EnabledWithError(m, testFeature)
	require.NoError(t, err)
	require.True(t, on)

	// turn it off server side
	_, err = tc.G.API.Post(m, libkb.APIArg{
		Endpoint:    "test/feature",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"feature":   libkb.S{Val: string(testFeature)},
			"value":     libkb.I{Val: 0},
			"cache_sec": libkb.I{Val: 100},
		},
	})
	require.NoError(t, err)

	// Still on, since it's still cached.
	on, err = tc.G.FeatureFlags.EnabledWithError(m, testFeature)
	require.NoError(t, err)
	require.True(t, on)

	fakeClock.Advance(time.Hour * 10)
	for i := 0; i < 2; i++ {
		on, err = tc.G.FeatureFlags.EnabledWithError(m, testFeature)
		require.NoError(t, err)
		require.False(t, on)
	}
}
