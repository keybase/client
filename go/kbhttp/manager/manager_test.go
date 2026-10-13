package manager

import (
	"fmt"
	"net"
	"net/http"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Only BACKGROUND stops the server; INACTIVE keeps it up, and starts it when
// coming back from BACKGROUND.
func TestSrvAppState(t *testing.T) {
	tc := libkb.SetupTest(t, "kbhttp", 1)
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

// The address handed out before backgrounding should still be readable while
// the server is stopped, so URLs built while it was up keep resolving where
// it comes back.
func TestSrvAddrSurvivesBackground(t *testing.T) {
	tc := libkb.SetupTest(t, "kbhttp", 1)
	defer tc.Cleanup()
	srv := NewSrv(tc.G)
	require.True(t, srv.Active())
	before, err := srv.Addr()
	require.NoError(t, err)

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	require.Eventually(t, func() bool { return !srv.Active() }, 10*time.Second, time.Millisecond,
		"BACKGROUND did not stop the server")

	addr, err := srv.Addr()
	require.NoError(t, err)
	require.Equal(t, before, addr)
}

// The token handed out to build URLs should stay valid across a
// background/foreground cycle, so URLs cached while backgrounded still
// authenticate once the server comes back.
func TestSrvTokenStableAcrossBackground(t *testing.T) {
	tc := libkb.SetupTest(t, "kbhttp", 1)
	defer tc.Cleanup()
	srv := NewSrv(tc.G)
	require.True(t, srv.Active())
	before := srv.Token()

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	require.Eventually(t, func() bool { return !srv.Active() }, 10*time.Second, time.Millisecond,
		"BACKGROUND did not stop the server")

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	require.Eventually(t, srv.Active, 10*time.Second, time.Millisecond,
		"FOREGROUND did not start the server")

	require.Equal(t, before, srv.Token())
}

// capturingListenerSource hands out real listeners from a random-port range,
// like NewSrv's own source, and remembers the last one so a test can kill it
// underneath the server.
type capturingListenerSource struct {
	sync.Mutex
	src  kbhttp.ListenerSource
	last net.Listener
}

func newCapturingListenerSource() *capturingListenerSource {
	return &capturingListenerSource{src: kbhttp.NewRandomPortRangeListenerSource(20000, 40000)}
}

func (c *capturingListenerSource) GetListener() (net.Listener, string, error) {
	listener, address, err := c.src.GetListener()
	c.Lock()
	defer c.Unlock()
	if err == nil {
		c.last = listener
	}
	return listener, address, err
}

func (c *capturingListenerSource) closeLast(t *testing.T) {
	c.Lock()
	defer c.Unlock()
	require.NoError(t, c.last.Close())
}

// If the server's listener dies out from under it (the OS reclaiming a
// socket, say) without Stop() being called, a later foregrounding should
// still bring the server back up.
func TestSrvRecoversAfterServeExits(t *testing.T) {
	if runtime.GOOS == "android" {
		t.Skip("monitorAppState is a no-op on android")
	}
	tc := libkb.SetupTest(t, "kbhttp", 1)
	defer tc.Cleanup()
	srv := NewSrv(tc.G)
	require.True(t, srv.Active())

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	require.Eventually(t, func() bool { return !srv.Active() }, 10*time.Second, time.Millisecond,
		"BACKGROUND did not stop the server")

	source := newCapturingListenerSource()
	srv.httpSrv = kbhttp.NewSrv(tc.G.Log, source)
	srv.startHTTPSrv()
	require.True(t, srv.Active(), "startHTTPSrv did not bind")
	addr, err := srv.Addr()
	require.NoError(t, err)

	// Kill the bound listener directly, bypassing Stop(), so the server's
	// serve loop dies while the manager still believes it is running.
	source.closeLast(t)

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	require.Eventually(t, func() bool {
		resp, err := http.Get(fmt.Sprintf("http://%s/", addr))
		if err != nil {
			return false
		}
		resp.Body.Close()
		return true
	}, 5*time.Second, 10*time.Millisecond, "server never recovered after its listener died")
}
