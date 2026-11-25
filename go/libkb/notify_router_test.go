// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Notifications for one connection are queued onto a per-connection serial
// sender, so HandleLogout then SendLogin must arrive in that order even when
// many pairs are queued back to back.
func TestNotificationsArriveInOrder(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()

	ctx := context.Background()
	const rounds = 200
	for range rounds {
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

// After Shutdown, a notification handler must not deliver to a live connection.
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

// Dropping a queued WaitGroup send (Shutdown) must still Done the group, or
// every enqueueWG caller hangs forever.
func TestShutdownDropsEnqueueWGWithoutHang(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()

	// Hold the sender so a later enqueueWG job stays queued until Shutdown.
	release := make(chan struct{})
	held := make(chan struct{})
	require.True(t, g.NotifyRouter.enqueue(rec.ID, func() {
		close(held)
		<-release
	}))
	<-held

	var wg sync.WaitGroup
	g.NotifyRouter.enqueueWG(&wg, rec.ID, func() {})

	g.NotifyRouter.Shutdown()
	close(release)

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("wg.Wait hung; dropped enqueueWG job did not Done the WaitGroup")
	}
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
