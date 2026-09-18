package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func newTestNotifyCtlHandler(t *testing.T, g *libkb.GlobalContext) (*NotifyCtlHandler, *Service, libkb.ConnectionID) {
	t.Helper()
	svc := NewService(g, false)
	connID := g.NotifyRouter.AddConnection(nil, nil)
	return NewNotifyCtlHandler(nil, connID, g, svc), svc, connID
}

// The reply carries no session until the service's startup login attempt has
// settled. Reporting a logged-out session in that window would be wrong rather
// than merely early, and the client would then have to be corrected out of it by
// a notification whose send is fire-and-forget -- so the window must not exist.
func TestSetNotificationsHoldsBackAnUnsettledSession(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	h, svc, _ := newTestNotifyCtlHandler(t, g)

	res, err := h.SetNotifications(context.Background(), keybase1.NotificationChannels{Session: true})
	require.NoError(t, err)
	require.Nil(t, res.Session, "the startup login attempt has not run")
	require.NotZero(t, res.Version.Epoch, "the read is still labelled")

	svc.initialLoginAttemptOnce.Do(func() { close(svc.initialLoginAttemptDone) })

	res, err = h.SetNotifications(context.Background(), keybase1.NotificationChannels{Session: true})
	require.NoError(t, err)
	require.NotNil(t, res.Session, "the attempt settled, so there is a session to report")
	require.False(t, res.Session.LoggedIn, "logged out in a fresh test context")
}

// The channels are registered before the state is read, in that one call. A read
// that came first could describe a change that this connection was not yet
// subscribed to hear about, which is the gap the reply exists to close.
func TestSetNotificationsRegistersBeforeReadingState(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	h, svc, connID := newTestNotifyCtlHandler(t, g)
	svc.initialLoginAttemptOnce.Do(func() { close(svc.initialLoginAttemptDone) })

	// a change announced before anyone subscribed
	g.NotifyRouter.HandleLogout(context.Background())
	announced := g.StateVersion()

	// The registration is what makes the read safe, so observe it from the read
	// itself: ActiveDevice is read inside SetNotifications, and a logout announced
	// from here would already have been delivered to this connection.
	require.False(t, g.NotifyRouter.GetChannels(connID).Session, "not subscribed yet")

	// only Session, so nothing below actually sends down this test's nil transport
	res, err := h.SetNotifications(context.Background(), keybase1.NotificationChannels{Session: true})
	require.NoError(t, err)
	require.True(t, g.NotifyRouter.GetChannels(connID).Session, "subscribed by the time it returned")

	require.Equal(t, announced.Epoch, res.Version.Epoch)
	require.GreaterOrEqual(t, res.Version.Counter, announced.Counter,
		"the read is labelled no earlier than everything already announced")

	// a change announced after subscribing is strictly newer than the reply, which
	// is what lets the client keep the notification over the reply
	g.NotifyRouter.HandleHTTPSrvInfoUpdate(context.Background(), keybase1.HttpSrvInfo{Address: "127.0.0.1:1", Token: "t"})
	require.Greater(t, g.StateVersion().Counter, res.Version.Counter)
}
