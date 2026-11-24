// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func takeMemberCountSignal(c *TeamMemberCountCache) bool {
	select {
	case <-c.notifyCh:
		return true
	default:
		return false
	}
}

func TestTeamMemberCountCacheSignalsOnlyRealChanges(t *testing.T) {
	// notifyLoop is not started, so the test reads notifyCh itself
	c := &TeamMemberCountCache{
		cache:    make(map[keybase1.TeamID]int),
		pending:  make(map[keybase1.TeamID]struct{}),
		notifyCh: make(chan struct{}, 1),
	}
	explicit := keybase1.TeamID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa24")
	implicit := keybase1.TeamID("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb24")

	c.Set(explicit, 3, true)
	require.True(t, takeMemberCountSignal(c), "first count of an explicit team signals")
	c.Set(explicit, 3, true)
	require.False(t, takeMemberCountSignal(c), "same count does not signal")
	c.Set(explicit, 4, true)
	require.True(t, takeMemberCountSignal(c), "changed count signals")

	c.Set(implicit, 2, false)
	require.False(t, takeMemberCountSignal(c), "silent set does not signal")
	c.Set(implicit, 5, false)
	require.False(t, takeMemberCountSignal(c), "silent change does not signal")
	count, ok := c.Get(implicit)
	require.True(t, ok)
	require.Equal(t, 5, count, "silent set still caches")
	teamID, ok := c.popPending()
	require.True(t, ok)
	require.Equal(t, explicit, teamID, "only signalled teams are pending")
	_, ok = c.popPending()
	require.False(t, ok, "popping takes the team off pending")
}

type blockingMemberCountListener struct {
	NoopNotifyListener
	entered chan keybase1.TeamID
	release chan struct{}
}

func (l *blockingMemberCountListener) TeamChanged(teamID keybase1.TeamID, kinds keybase1.TeamChangedKinds, _ keybase1.UserTeamVersion) {
	if !kinds.MemberCount {
		return
	}
	l.entered <- teamID
	<-l.release
}

// A logout while the notify loop is sending drops the member counts still
// queued for the old user.
func TestTeamMemberCountCacheLogoutDropsPendingSends(t *testing.T) {
	tc := SetupTest(t, "TeamMemberCountCache", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	listener := &blockingMemberCountListener{
		entered: make(chan keybase1.TeamID, 10),
		release: make(chan struct{}),
	}
	g.NotifyRouter.AddListener(listener)

	c := g.TeamMemberCountCache
	// fill pending before signalling so one loop round sees both teams
	c.lock.Lock()
	c.pending[keybase1.TeamID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa24")] = struct{}{}
	c.pending[keybase1.TeamID("cccccccccccccccccccccccccccccc24")] = struct{}{}
	c.lock.Unlock()
	c.notifyCh <- struct{}{}

	select {
	case <-listener.entered:
	case <-time.After(10 * time.Second):
		t.Fatal("no memberCount teamChanged sent")
	}
	require.NoError(t, c.OnLogout(NewMetaContextForTest(tc)))
	close(listener.release)

	select {
	case teamID := <-listener.entered:
		t.Fatalf("memberCount teamChanged for %s sent after logout", teamID)
	case <-time.After(6 * time.Second):
	}
}

// The notify loop sends one teamChanged per team whose count changed, to
// connections on the teamChanged channel, and still one teamMetadataUpdate to
// the others.
func TestTeamMemberCountCacheNotifiesEachTeam(t *testing.T) {
	tc := SetupTest(t, "TeamMemberCountCache", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	app := NewNotifyRecorder(g, keybase1.NotificationChannels{Team: true, TeamChanged: true})
	defer app.Close()
	coarse := NewNotifyRecorder(g, keybase1.NotificationChannels{Team: true})
	defer coarse.Close()

	a := keybase1.TeamID("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa24")
	b := keybase1.TeamID("cccccccccccccccccccccccccccccc24")
	implicit := keybase1.TeamID("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb24")
	g.TeamMemberCountCache.Set(a, 3, true)
	g.TeamMemberCountCache.Set(implicit, 2, false)
	g.TeamMemberCountCache.Set(b, 4, true)

	// the loop sends at most every 5s, so a and b can land in separate rounds
	require.Eventually(t, func() bool {
		return len(app.Messages()) == 2
	}, 15*time.Second, 10*time.Millisecond)
	got := map[keybase1.TeamID]keybase1.TeamChangedKinds{}
	for _, m := range app.Messages() {
		require.Equal(t, "keybase.1.NotifyTeam.teamChanged", m.Method)
		var arg keybase1.TeamChangedArg
		require.NoError(t, m.Decode(&arg))
		got[arg.TeamID] = arg.Kinds
	}
	require.Equal(t, map[keybase1.TeamID]keybase1.TeamChangedKinds{
		a: {MemberCount: true},
		b: {MemberCount: true},
	}, got)
	require.Eventually(t, func() bool {
		return len(coarse.Messages()) > 0
	}, 15*time.Second, 10*time.Millisecond)
	for _, m := range coarse.Messages() {
		require.Equal(t, "keybase.1.NotifyTeam.teamMetadataUpdate", m.Method)
	}
}
