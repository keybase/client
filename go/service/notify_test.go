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

// What is checkable from out here: the call registers the channels, labels the
// read no earlier than everything already announced, and leaves every later
// change strictly newer than that label -- which together are what let a client
// keep a notification over the reply.
//
// The register-before-read order inside SetNotifications is not observable from
// here and is not pinned here: it is pinned by the compiler instead, because the
// version labelling the reply is SetChannels' return value and there is no reply
// to build without first having called it.
func TestSetNotificationsRegistersChannelsAndLabelsTheRead(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	h, svc, connID := newTestNotifyCtlHandler(t, g)
	svc.initialLoginAttemptOnce.Do(func() { close(svc.initialLoginAttemptDone) })

	// a change announced before anyone subscribed
	g.NotifyRouter.HandleLogout(context.Background())
	announced := g.StateVersion()

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

// The app state is derived here and nowhere else, so a client that started late
// -- on iOS JS never starts on a background launch -- has no earlier reading to
// order against: the reply is its first and only catch-up.
func TestSetNotificationsCarriesTheAppState(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	h, _, _ := newTestNotifyCtlHandler(t, g)

	res, err := h.SetNotifications(context.Background(), keybase1.NotificationChannels{Session: true})
	require.NoError(t, err)
	require.Equal(t, g.MobileAppState.State(), res.AppState)

	g.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	res, err = h.SetNotifications(context.Background(), keybase1.NotificationChannels{Session: true})
	require.NoError(t, err)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, res.AppState)
	require.GreaterOrEqual(t, res.Version.Counter, g.StateVersion().Counter-1,
		"labelled no earlier than the change it reports")
}
