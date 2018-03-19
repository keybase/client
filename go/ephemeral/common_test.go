package ephemeral

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func ephemeralKeyTestSetup(t *testing.T) libkb.TestContext {
	tc := libkb.SetupTest(t, "ephemeral", 2)
	NewEphemeralStorageAndInstall(tc.G)
	return tc
}

func TestTimeConversions(t *testing.T) {
	// In this package, we assume that keybase1.TimeFromSeconds(t).UnixSeconds()
	// is the exact same integer as t. Test that this is true.
	now := time.Now().Unix()
	require.Equal(t, now, keybase1.TimeFromSeconds(now).UnixSeconds())
}
