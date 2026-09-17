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
// compares the version on a bootstrap status against the versions on the
// notifications it got, so a change that stamped nothing would look older than a
// status read before it and be dropped.
func TestNotifyRouterStampsEachAnnouncedChange(t *testing.T) {
	tc := SetupTest(t, "StateVersion", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	ctx := context.Background()

	require.EqualValues(t, 0, g.StateVersion(), "nothing announced yet")

	g.NotifyRouter.HandleHTTPSrvInfoUpdate(ctx, keybase1.HttpSrvInfo{Address: "127.0.0.1:1", Token: "token"})
	afterHTTP := g.StateVersion()
	require.EqualValues(t, 1, afterHTTP)

	g.NotifyRouter.SendLogin(ctx, "testuser", false)
	afterLogin := g.StateVersion()
	require.Greater(t, afterLogin, afterHTTP)

	g.NotifyRouter.HandleLogout(ctx)
	require.Greater(t, g.StateVersion(), afterLogin)
}
