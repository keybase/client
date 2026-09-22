package manager

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Only BACKGROUND stops the server; INACTIVE keeps it up, and starts it when
// coming back from BACKGROUND.
func TestSrvAppState(t *testing.T) {
	tc := libkb.SetupTest(t, "httpsrv", 1)
	defer tc.Cleanup()
	srv := NewSrv(tc.G)
	require.True(t, srv.Active())

	tc.G.MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
	require.Never(t, func() bool { return !srv.Active() }, 200*time.Millisecond, time.Millisecond,
		"INACTIVE stopped the server")

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	require.Eventually(t, func() bool { return !srv.Active() }, 10*time.Second, time.Millisecond,
		"BACKGROUND did not stop the server")

	tc.G.MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
	require.Eventually(t, srv.Active, 10*time.Second, time.Millisecond,
		"INACTIVE after BACKGROUND did not start the server")
}
