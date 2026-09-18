// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Every announced change gets its own version, and the version is readable
// through StateVersion by the time the notification is on its way out. A client
// compares the version on the snapshot it got from setNotifications against the
// versions on the notifications it got, so a change that stamped nothing would
// look older than a snapshot read before it and be dropped.
func TestNotifyRouterStampsEachAnnouncedChange(t *testing.T) {
	tc := SetupTest(t, "StateVersion", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	ctx := context.Background()

	epoch := g.StateVersion().Epoch
	require.Less(t, epoch, int64(1)<<53, "a JS client decodes this into a float64")
	require.EqualValues(t, 0, g.StateVersion().Counter, "nothing announced yet")

	g.NotifyRouter.HandleHTTPSrvInfoUpdate(ctx, keybase1.HttpSrvInfo{Address: "127.0.0.1:1", Token: "token"})
	afterHTTP := g.StateVersion()
	require.EqualValues(t, 1, afterHTTP.Counter)

	g.NotifyRouter.SendLogin(ctx, "testuser", false)
	afterLogin := g.StateVersion()
	require.Greater(t, afterLogin.Counter, afterHTTP.Counter)

	g.NotifyRouter.HandleLogout(ctx)
	require.Greater(t, g.StateVersion().Counter, afterLogin.Counter)

	require.Equal(t, epoch, g.StateVersion().Epoch, "the epoch never moves within a process")
}

// A client keeps the versions it applied across a reconnect and tells a
// restarted service from a continuing one by the epoch, so two services must
// never share one.
func TestStateVersionEpochsDiffer(t *testing.T) {
	first := SetupTest(t, "StateVersionA", 0)
	defer first.Cleanup()
	second := SetupTest(t, "StateVersionB", 0)
	defer second.Cleanup()

	require.NotEqual(t, first.G.StateVersion().Epoch, second.G.StateVersion().Epoch)
}
