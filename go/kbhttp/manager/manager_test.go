package manager

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestSrvKeepsAddressWhileInactive(t *testing.T) {
	tc := libkb.SetupTest(t, "TestSrvKeepsAddressWhileInactive", 1)
	defer tc.Cleanup()
	srv := NewSrv(tc.G)
	addr, err := srv.Addr()
	require.NoError(t, err)
	token := srv.Token()
	require.NotEmpty(t, token)

	// inactive and back: rendered URLs must keep working, so nothing changes
	srv.handleAppState(keybase1.MobileAppState_INACTIVE)
	require.True(t, srv.Active())
	srv.handleAppState(keybase1.MobileAppState_FOREGROUND)
	got, err := srv.Addr()
	require.NoError(t, err)
	require.Equal(t, addr, got)
	require.Equal(t, token, srv.Token())

	// a background stops it, and the next foreground starts it with a fresh token
	srv.handleAppState(keybase1.MobileAppState_BACKGROUND)
	require.False(t, srv.Active())
	srv.handleAppState(keybase1.MobileAppState_FOREGROUND)
	require.True(t, srv.Active())
	require.NotEqual(t, token, srv.Token())
}
