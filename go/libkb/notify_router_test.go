// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Every notification a NotifyRouter sends goes out on its own goroutine
// (HandleLogout, SendLogin), so two notifications queued to the same
// connection in one order can be written to it in the other. A client that
// applies loggedIn/loggedOut as state can end up with the wrong one last.
func TestNotificationsArriveInOrder(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()

	ctx := context.Background()
	const rounds = 200
	for i := 0; i < rounds; i++ {
		g.NotifyRouter.HandleLogout(ctx)
		g.NotifyRouter.SendLogin(ctx, "testuser", false)
	}

	require.Eventually(t, func() bool {
		return len(rec.Messages()) == rounds*2
	}, 10*time.Second, 10*time.Millisecond, "expected %d messages", rounds*2)

	msgs := rec.Messages()
	for i, m := range msgs {
		want := "keybase.1.NotifySession.loggedOut"
		if i%2 == 1 {
			want = "keybase.1.NotifySession.loggedIn"
		}
		require.Equal(t, want, m.Method, "message %d arrived out of the order it was queued in", i)
	}
}

// NotifyRouter.Shutdown is a no-op on master: nothing stops a connection's
// in-flight notification goroutines, so a notification queued right before
// shutdown still reaches a recorder that outlives the router.
func TestShutdownStopsSenders(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()

	g.NotifyRouter.Shutdown()
	g.NotifyRouter.HandleLogout(context.Background())

	require.Never(t, func() bool {
		return len(rec.Messages()) > 0
	}, 200*time.Millisecond, 10*time.Millisecond, "Shutdown must stop senders before they deliver")
}

// A late SetChannels for a connection that has already closed must not bring
// its entry back: nothing would ever remove it again.
func TestSetChannelsAfterCloseRegistersNothing(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	n := g.NotifyRouter

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	id := rec.ID
	rec.Close()

	require.Eventually(t, func() bool {
		return n.cm.LookupConnection(id) == nil
	}, 5*time.Second, time.Millisecond, "connection should be gone from the manager after Close")

	n.SetChannels(id, keybase1.NotificationChannels{Session: true})

	n.Lock()
	_, registered := n.state[id]
	n.Unlock()
	require.False(t, registered, "SetChannels must not resurrect a closed connection's state entry")
}
