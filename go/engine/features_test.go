package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestFeatureFlagSet(t *testing.T) {
	tc := SetupEngineTest(t, "features")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)
	m := NewMetaContextForTest(tc)
	CreateAndSignupFakeUserPaper(tc, "feat")
	on, err := tc.G.FeatureFlags.EnabledWithError(m, libkb.FeatureFTL)
	require.NoError(t, err)
	require.False(t, on)

	_, err = tc.G.API.Post(libkb.APIArg{
		Endpoint:    "test/feature",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"feature":   libkb.S{Val: string(libkb.FeatureFTL)},
			"value":     libkb.I{Val: 1},
			"cache_sec": libkb.I{Val: 100},
		},
		MetaContext: m,
	})
	require.NoError(t, err)

	// Still off, since it's still cached.
	on, err = tc.G.FeatureFlags.EnabledWithError(m, libkb.FeatureFTL)
	require.NoError(t, err)
	require.False(t, on)

	fakeClock.Advance(time.Hour * 10)
	for i := 0; i < 2; i++ {
		on, err = tc.G.FeatureFlags.EnabledWithError(m, libkb.FeatureFTL)
		require.NoError(t, err)
		require.True(t, on)
	}
}
