// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

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
}
