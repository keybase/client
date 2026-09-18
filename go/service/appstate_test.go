package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// The take is what makes a tap exactly-once: it is the only reader of the
// pending tap, and it clears. A client that reconnects, or a fresh one after a
// reload, gets nothing rather than the tap it already acted on.
func TestTakePushTapRouteClearsTheTap(t *testing.T) {
	tc := libkb.SetupTest(t, "appstate", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	h := newAppStateHandler(nil, g)
	ctx := context.Background()

	got, err := h.TakePushTapRoute(ctx)
	require.NoError(t, err)
	require.Nil(t, got, "no tap has happened")

	route := keybase1.PushTapRoute{Url: "keybase://convid/0000ab", TargetUID: "u1"}
	g.PendingPushTap.Set(ctx, route)

	got, err = h.TakePushTapRoute(ctx)
	require.NoError(t, err)
	require.Equal(t, &route, got)

	got, err = h.TakePushTapRoute(ctx)
	require.NoError(t, err)
	require.Nil(t, got, "the tap was already handed out")
}

// A tap must ride its own call and nothing else. setNotifications answers every
// subscriber -- kbfs subscribes from inside this same process -- so a tap
// carried in that reply would be consumed by whichever one subscribed first.
func TestSetNotificationsLeavesTheTapAlone(t *testing.T) {
	tc := libkb.SetupTest(t, "appstate", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	ctx := context.Background()
	route := keybase1.PushTapRoute{Url: "keybase://devices", TargetUID: "u1"}
	g.PendingPushTap.Set(ctx, route)

	n, svc, _ := newTestNotifyCtlHandler(t, g)
	svc.initialLoginAttemptOnce.Do(func() { close(svc.initialLoginAttemptDone) })
	_, err := n.SetNotifications(ctx, keybase1.NotificationChannels{App: true})
	require.NoError(t, err)

	got, err := newAppStateHandler(nil, g).TakePushTapRoute(ctx)
	require.NoError(t, err)
	require.Equal(t, &route, got, "the subscribe did not consume the tap")
}
