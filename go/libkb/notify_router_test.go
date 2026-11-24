// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"errors"
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

func (s *sessionState) read(MetaContext) (keybase1.BootstrapStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return keybase1.BootstrapStatus{LoggedIn: s.username != "", Username: s.username}, nil
}

// waitSessionSent waits until the read that began last has been sent and has reached rec.
func waitSessionSent(t *testing.T, n *NotifyRouter, rec *NotifyRecorder) {
	require.Eventually(t, func() bool {
		n.sessionMu.Lock()
		done, seq := n.sessionReadSent == n.sessionReadsStarted, n.sessionSeq
		n.sessionMu.Unlock()
		got := sessionChanges(t, rec)
		return done && len(got) > 0 && got[len(got)-1].SessionSeq == seq
	}, 10*time.Second, time.Millisecond)
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

	read, err := g.NotifyRouter.SessionStatus(NewMetaContext(ctx, g))
	require.NoError(t, err)
	require.Equal(t, "testuser-mac", read.Username)
	require.Equal(t, 3, read.SessionSeq, "a read carries the seq of the latest sessionChanged before it")
}

// Back-to-back changes: every connection sees increasing seqs, and the last status it gets is the
// session as it ended. Reads that a later one overtook are not sent.
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
		waitSessionSent(t, g.NotifyRouter, rec)
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
	g.NotifyRouter.SetSessionStatusSource(func(m MetaContext) (keybase1.BootstrapStatus, error) {
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

// stallFirstRead makes the first session read take its status and then wait for release, as a
// slow read that a later change overtakes.
func stallFirstRead(state *sessionState) (source SessionStatusSource, reading <-chan struct{}, release func()) {
	var once sync.Once
	readingCh := make(chan struct{})
	releaseCh := make(chan struct{})
	source = func(m MetaContext) (keybase1.BootstrapStatus, error) {
		status, err := state.read(m)
		first := false
		once.Do(func() { first = true })
		if first {
			close(readingCh)
			<-releaseCh
		}
		return status, err
	}
	return source, readingCh, func() { close(releaseCh) }
}

// A slow read for sessionChanged must not hold up a caller reading the session.
func TestSessionStatusDoesNotWaitOnASessionChangedRead(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	state := &sessionState{}
	source, reading, release := stallFirstRead(state)
	defer release()
	g.NotifyRouter.SetSessionStatusSource(source)
	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()

	state.set("testuser")
	g.NotifyRouter.HandleLogin(context.Background(), "testuser")
	<-reading

	type result struct {
		status keybase1.BootstrapStatus
		err    error
	}
	read := make(chan result)
	go func() {
		status, err := g.NotifyRouter.SessionStatus(NewMetaContext(context.Background(), g))
		read <- result{status, err}
	}()
	select {
	case res := <-read:
		require.NoError(t, res.err)
		status := res.status
		require.Equal(t, "testuser", status.Username)
		require.Equal(t, 0, status.SessionSeq)
	case <-time.After(5 * time.Second):
		t.Fatal("SessionStatus waited on the sessionChanged read")
	}
}

// A read that a later-begun read overtook is dropped, not sent with a newer seq than the later one.
func TestSessionChangedDropsAnOvertakenRead(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	state := &sessionState{}
	source, reading, release := stallFirstRead(state)
	g.NotifyRouter.SetSessionStatusSource(source)
	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()
	ctx := context.Background()

	g.NotifyRouter.HandleLogout(ctx)
	<-reading
	state.set("testuser")
	g.NotifyRouter.HandleLogin(ctx, "testuser")
	require.Eventually(t, func() bool {
		return len(sessionChanges(t, rec)) == 1
	}, 5*time.Second, time.Millisecond)

	release()
	require.Never(t, func() bool {
		return len(sessionChanges(t, rec)) > 1
	}, 500*time.Millisecond, time.Millisecond, "the overtaken read was sent")
	got := sessionChanges(t, rec)
	require.Equal(t, "testuser", got[0].Username)
	require.Equal(t, 1, got[0].SessionSeq)
}

// A sessionChanged read that a caller's read began after is read again: sent as read, its older
// status would outrank the caller's newer one.
func TestSessionChangedRereadsAfterACallersRead(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	state := &sessionState{}
	source, reading, release := stallFirstRead(state)
	g.NotifyRouter.SetSessionStatusSource(source)
	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{Session: true})
	defer rec.Close()
	ctx := context.Background()

	state.set("testuser")
	g.NotifyRouter.HandleLogin(ctx, "testuser")
	<-reading
	// the push's read saw testuser; the session then ends and a caller reads it
	state.set("")
	status, err := g.NotifyRouter.SessionStatus(NewMetaContext(ctx, g))
	require.NoError(t, err)
	require.False(t, status.LoggedIn)
	require.Equal(t, 0, status.SessionSeq)

	release()
	require.Eventually(t, func() bool {
		return len(sessionChanges(t, rec)) == 1
	}, 5*time.Second, time.Millisecond)
	got := sessionChanges(t, rec)
	require.False(t, got[0].LoggedIn, "the push sent its older read above the caller's")
	require.Equal(t, 1, got[0].SessionSeq)
}

func TestSessionStatusFailsWithoutASource(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	tc.G.SetService()
	m := NewMetaContextForTest(tc)

	_, err := tc.G.NotifyRouter.SessionStatus(m)
	require.Error(t, err)

	var nilRouter *NotifyRouter
	_, err = nilRouter.SessionStatus(m)
	require.Error(t, err)
}

func TestSessionStatusReturnsTheReadError(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	tc.G.SetService()
	tc.G.NotifyRouter.SetSessionStatusSource(func(MetaContext) (keybase1.BootstrapStatus, error) {
		return keybase1.BootstrapStatus{LoggedIn: true}, errors.New("read failed")
	})

	_, err := tc.G.NotifyRouter.SessionStatus(NewMetaContextForTest(tc))
	require.EqualError(t, err, "read failed")
}

// A connection on the teamChanged channel gets one teamChanged per change and
// none of the coarse team notifications it replaces; a connection on only the
// team channel keeps getting those.
func TestTeamChangedReplacesCoarseTeamNotifications(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	app := NewNotifyRecorder(g, keybase1.NotificationChannels{Team: true, TeamChanged: true})
	defer app.Close()
	coarse := NewNotifyRecorder(g, keybase1.NotificationChannels{Team: true})
	defer coarse.Close()

	ctx := context.Background()
	n := g.NotifyRouter
	teamID := keybase1.TeamID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa24")
	n.HandleTeamChangedByBothKeys(ctx, teamID, "testteam", 3, false,
		keybase1.TeamChangeSet{MembershipChanged: true, Misc: true}, 0, 0, keybase1.TeamChangedSource_SERVER)
	n.HandleTeamDeleted(ctx, teamID)
	n.HandleTeamExit(ctx, teamID)
	n.HandleTeamRoleMapChanged(ctx, 7)
	n.HandleTeamMetadataUpdate(ctx)
	n.HandleTeamChanged(ctx, teamID, keybase1.TeamChangedKinds{Channels: true}, 0)

	type sent struct {
		TeamID  keybase1.TeamID
		Kinds   keybase1.TeamChangedKinds
		Version keybase1.UserTeamVersion
	}
	want := []sent{
		{TeamID: teamID, Kinds: keybase1.TeamChangedKinds{Membership: true, Settings: true}},
		{TeamID: teamID, Kinds: keybase1.TeamChangedKinds{Deleted: true}},
		{TeamID: teamID, Kinds: keybase1.TeamChangedKinds{Exited: true}},
		{Kinds: keybase1.TeamChangedKinds{RoleMap: true}, Version: 7},
		{TeamID: teamID, Kinds: keybase1.TeamChangedKinds{Channels: true}},
	}
	require.Eventually(t, func() bool {
		return len(app.Messages()) >= len(want)
	}, 10*time.Second, 10*time.Millisecond)
	var got []sent
	for _, m := range app.Messages() {
		require.Equal(t, "keybase.1.NotifyTeam.teamChanged", m.Method)
		var arg keybase1.TeamChangedArg
		require.NoError(t, m.Decode(&arg))
		got = append(got, sent{TeamID: arg.TeamID, Kinds: arg.Kinds, Version: arg.RoleMapVersion})
	}
	require.Equal(t, want, got)

	wantCoarse := []string{
		"keybase.1.NotifyTeam.teamChangedByID",
		"keybase.1.NotifyTeam.teamChangedByName",
		"keybase.1.NotifyTeam.teamDeleted",
		"keybase.1.NotifyTeam.teamExit",
		"keybase.1.NotifyTeam.teamRoleMapChanged",
		"keybase.1.NotifyTeam.teamMetadataUpdate",
	}
	require.Eventually(t, func() bool {
		return len(coarse.Messages()) >= len(wantCoarse)
	}, 10*time.Second, 10*time.Millisecond)
	var gotCoarse []string
	for _, m := range coarse.Messages() {
		gotCoarse = append(gotCoarse, m.Method)
	}
	require.Equal(t, wantCoarse, gotCoarse)
}

type teamChangedListener struct {
	NoopNotifyListener
	sync.Mutex
	kinds []keybase1.TeamChangedKinds
}

func (l *teamChangedListener) TeamChanged(_ keybase1.TeamID, kinds keybase1.TeamChangedKinds, _ keybase1.UserTeamVersion) {
	l.Lock()
	defer l.Unlock()
	l.kinds = append(l.kinds, kinds)
}

// A change set with no flag that teamChanged carries (gregor rows copy theirs
// per message) sends no teamChanged; coarse connections still get
// teamChangedByID.
func TestTeamChangedSkipsEmptyKinds(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	app := NewNotifyRecorder(g, keybase1.NotificationChannels{Team: true, TeamChanged: true})
	defer app.Close()
	coarse := NewNotifyRecorder(g, keybase1.NotificationChannels{Team: true})
	defer coarse.Close()
	listener := &teamChangedListener{}
	g.NotifyRouter.AddListener(listener)

	ctx := context.Background()
	n := g.NotifyRouter
	teamID := keybase1.TeamID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa24")
	n.HandleTeamChangedByID(ctx, teamID, 3, false, keybase1.TeamChangeSet{}, 0, 0, keybase1.TeamChangedSource_SERVER)
	n.HandleTeamChanged(ctx, teamID, keybase1.TeamChangedKinds{}, 0)
	n.HandleTeamChangedByID(ctx, teamID, 4, false, keybase1.TeamChangeSet{Renamed: true}, 0, 0, keybase1.TeamChangedSource_SERVER)

	// each send waits for delivery, and the recorder records before the send returns
	var got []keybase1.TeamChangedKinds
	for _, m := range app.Messages() {
		require.Equal(t, "keybase.1.NotifyTeam.teamChanged", m.Method)
		var arg keybase1.TeamChangedArg
		require.NoError(t, m.Decode(&arg))
		got = append(got, arg.Kinds)
	}
	want := []keybase1.TeamChangedKinds{{Renamed: true}}
	require.Equal(t, want, got)
	listener.Lock()
	require.Equal(t, want, listener.kinds)
	listener.Unlock()
	require.Len(t, coarse.Messages(), 2)
}
