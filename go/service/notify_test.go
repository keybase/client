package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// The reply to setNotifications is what a client applies instead of ordering a
// separate read against its subscription, so the two have to happen in this
// order and in this call: the channels are registered first, and only then is
// the state read and labelled. A state read before the registration could
// describe a change nobody announced.
func TestSetNotificationsRegistersThenSnapshots(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	svc := NewService(g, false)
	connID := g.NotifyRouter.AddConnection(nil, nil)
	h := NewNotifyCtlHandler(nil, connID, g, svc)

	// a change announced before anyone subscribed
	g.NotifyRouter.HandleLogout(context.Background())
	announced := g.StateVersion()

	// only Session, so nothing below actually sends down this test's nil transport
	res, err := h.SetNotifications(context.Background(), keybase1.NotificationChannels{Session: true})
	require.NoError(t, err)

	require.True(t, g.NotifyRouter.GetChannels(connID).Session, "channels registered")
	require.Equal(t, announced.Epoch, res.Version.Epoch)
	require.GreaterOrEqual(t, res.Version.Counter, announced.Counter,
		"the snapshot is read after everything already announced")
	require.False(t, res.LoggedIn, "logged out in a fresh test context")

	// a change announced after subscribing is strictly newer than the snapshot,
	// which is what lets the client keep the notification over the snapshot
	g.NotifyRouter.HandleHTTPSrvInfoUpdate(context.Background(), keybase1.HttpSrvInfo{Address: "127.0.0.1:1", Token: "t"})
	require.Greater(t, g.StateVersion().Counter, res.Version.Counter)
}
