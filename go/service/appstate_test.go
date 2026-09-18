package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// A peek is not a take. The reply can be lost on the way to the client, and the
// client is the only party that knows whether it acted, so the route stays armed
// until the client says so -- a lost reply then costs a repeat, not the tap.
func TestPeekPushTapRouteLeavesTheTapArmed(t *testing.T) {
	tc := libkb.SetupTest(t, "appstate", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	h := newAppStateHandler(nil, g)
	ctx := context.Background()

	got, err := h.PeekPushTapRoute(ctx)
	require.NoError(t, err)
	require.Nil(t, got, "no tap has happened")

	g.PendingPushTap.Set(ctx, keybase1.PushTapRoute{Url: "keybase://convid/0000ab", TargetUID: "u1"})

	first, err := h.PeekPushTapRoute(ctx)
	require.NoError(t, err)
	require.NotNil(t, first)
	require.Equal(t, "keybase://convid/0000ab", first.Url)

	again, err := h.PeekPushTapRoute(ctx)
	require.NoError(t, err)
	require.Equal(t, first, again, "still armed for a client that never got the first reply")

	require.NoError(t, h.AckPushTapRoute(ctx, first.Id))

	got, err = h.PeekPushTapRoute(ctx)
	require.NoError(t, err)
	require.Nil(t, got, "the client said it acted")
}

// An ack that crosses a newer tap must retire nothing: the user tapped again,
// and that tap has not been acted on.
func TestAckPushTapRouteIgnoresAStaleID(t *testing.T) {
	tc := libkb.SetupTest(t, "appstate", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	h := newAppStateHandler(nil, g)
	ctx := context.Background()

	g.PendingPushTap.Set(ctx, keybase1.PushTapRoute{Url: "keybase://convid/0000ab"})
	stale, err := h.PeekPushTapRoute(ctx)
	require.NoError(t, err)
	require.NotNil(t, stale)

	g.PendingPushTap.Set(ctx, keybase1.PushTapRoute{Url: "keybase://devices", TargetUID: "u2"})

	require.NoError(t, h.AckPushTapRoute(ctx, stale.Id))

	survived, err := h.PeekPushTapRoute(ctx)
	require.NoError(t, err)
	require.NotNil(t, survived)
	require.Equal(t, "keybase://devices", survived.Url)
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

	got, err := newAppStateHandler(nil, g).PeekPushTapRoute(ctx)
	require.NoError(t, err)
	require.NotNil(t, got, "the subscribe did not consume the tap")
	require.Equal(t, route.Url, got.Url)
}
