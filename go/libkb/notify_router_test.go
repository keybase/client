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

// sessionState stands in for the service's session reader (the Bootstrap engine, which libkb
// cannot import): it reports whichever user the test has made current.
type sessionState struct {
	mu       sync.Mutex
	username string
}

func (s *sessionState) set(u string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.username = u
}

func (s *sessionState) read(MetaContext) keybase1.BootstrapStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	return keybase1.BootstrapStatus{LoggedIn: s.username != "", Username: s.username}
}

func sessionChanges(t *testing.T, rec *NotifyRecorder) []keybase1.BootstrapStatus {
	var res []keybase1.BootstrapStatus
	for _, m := range rec.Messages() {
		if m.Method != "keybase.1.NotifySession.sessionChanged" {
			continue
		}
		var arg keybase1.SessionChangedArg
		require.NoError(t, m.Decode(&arg))
		res = append(res, arg.Status)
	}
	return res
}

// Each login and logout sends the session it led to, numbered in the order sent.
func TestSessionChangedFollowsLoginAndLogout(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	state := &sessionState{}
	g.NotifyRouter.SetSessionStatusSource(state.read)

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()
	ctx := context.Background()

	step := func(want int, change func()) {
		change()
		require.Eventually(t, func() bool {
			return len(sessionChanges(t, rec)) == want
		}, 5*time.Second, time.Millisecond)
	}
	step(1, func() {
		state.set("testuser")
		g.NotifyRouter.HandleLogin(ctx, "testuser")
	})
	step(2, func() {
		state.set("")
		g.NotifyRouter.HandleLogout(ctx)
	})
	step(3, func() {
		state.set("testuser-mac")
		g.NotifyRouter.HandleSignup(ctx, "testuser-mac")
	})

	got := sessionChanges(t, rec)
	require.Equal(t, []string{"testuser", "", "testuser-mac"},
		[]string{got[0].Username, got[1].Username, got[2].Username})
	require.Equal(t, []bool{true, false, true}, []bool{got[0].LoggedIn, got[1].LoggedIn, got[2].LoggedIn})
	require.Equal(t, []int{1, 2, 3}, []int{got[0].SessionSeq, got[1].SessionSeq, got[2].SessionSeq})

	read := g.NotifyRouter.SessionStatus(NewMetaContext(ctx, g))
	require.Equal(t, "testuser-mac", read.Username)
	require.Equal(t, 3, read.SessionSeq, "a read carries the seq of the latest sessionChanged before it")
}

// Back-to-back changes: every connection sees increasing seqs, and the last status it gets is the
// session as it ended.
func TestSessionChangedBurstEndsOnCurrentSession(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	state := &sessionState{}
	g.NotifyRouter.SetSessionStatusSource(state.read)

	recs := []*NotifyRecorder{
		NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true}),
		NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true}),
	}
	for _, rec := range recs {
		defer rec.Close()
	}
	ctx := context.Background()
	const rounds = 100
	last := ""
	for i := range rounds {
		state.set("")
		g.NotifyRouter.HandleLogout(ctx)
		last = "testuser"
		if i%2 == 1 {
			last = "testuser-mac"
		}
		state.set(last)
		g.NotifyRouter.HandleLogin(ctx, last)
	}

	for _, rec := range recs {
		require.Eventually(t, func() bool {
			return len(sessionChanges(t, rec)) == rounds*2
		}, 10*time.Second, time.Millisecond)
		got := sessionChanges(t, rec)
		for i, s := range got {
			require.Equal(t, i+1, s.SessionSeq, "sessionChanged %d arrived out of order", i)
		}
		require.Equal(t, last, got[len(got)-1].Username)
	}
}

// Logout announces while holding switchUserMu. Reading the session must not make it wait, or a
// read that needs a lock the logout holds deadlocks it.
func TestSessionChangedDoesNotBlockTheAnnouncer(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	var held sync.Mutex
	state := &sessionState{}
	g.NotifyRouter.SetSessionStatusSource(func(m MetaContext) keybase1.BootstrapStatus {
		held.Lock()
		defer held.Unlock()
		return state.read(m)
	})
	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()

	held.Lock()
	returned := make(chan struct{})
	go func() {
		g.NotifyRouter.HandleLogout(context.Background())
		close(returned)
	}()
	select {
	case <-returned:
	case <-time.After(5 * time.Second):
		t.Fatal("HandleLogout waited on the session read")
	}
	held.Unlock()
	require.Eventually(t, func() bool {
		return len(sessionChanges(t, rec)) == 1
	}, 5*time.Second, time.Millisecond)
}
