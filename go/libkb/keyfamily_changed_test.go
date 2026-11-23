// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type deviceHistoryCounter struct {
	NoopNotifyListener
	count int
}

func (d *deviceHistoryCounter) DeviceHistoryChanged() { d.count++ }

func TestKeyfamilyChangedTellsDeviceListsOnlyForSelf(t *testing.T) {
	tc := SetupTest(t, "keyfamily_changed", 1)
	defer tc.Cleanup()
	tc.G.SetService()

	me := keybase1.MakeTestUID(1)
	err := tc.G.Env.GetConfigWriter().SetUserConfig(NewUserConfig(me, "testuser", []byte{}, keybase1.DeviceID("")), true)
	require.NoError(t, err)

	counter := &deviceHistoryCounter{}
	tc.G.NotifyRouter.AddListener(counter)

	// someone else's key change says nothing about our devices
	tc.G.KeyfamilyChanged(context.Background(), keybase1.MakeTestUID(2))
	require.Equal(t, 0, counter.count)

	// a device of ours was added or revoked, here or elsewhere
	tc.G.KeyfamilyChanged(context.Background(), me)
	require.Equal(t, 1, counter.count)
}

func TestNotifyDeviceHistoryIfSelf(t *testing.T) {
	tc := SetupTest(t, "notify_device_history", 1)
	defer tc.Cleanup()
	tc.G.SetService()

	me := keybase1.MakeTestUID(1)
	err := tc.G.Env.GetConfigWriter().SetUserConfig(NewUserConfig(me, "testuser", []byte{}, keybase1.DeviceID("")), true)
	require.NoError(t, err)
	counter := &deviceHistoryCounter{}
	tc.G.NotifyRouter.AddListener(counter)

	tc.G.notifyDeviceHistoryIfSelf(keybase1.MakeTestUID(2))
	require.Equal(t, 0, counter.count)
	tc.G.notifyDeviceHistoryIfSelf(me)
	require.Equal(t, 1, counter.count)
}
