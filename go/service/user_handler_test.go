// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type keyfamilyChangedCounter struct {
	libkb.NoopNotifyListener
	count atomic.Int32
}

func (c *keyfamilyChangedCounter) KeyfamilyChanged(keybase1.UID) {
	c.count.Add(1)
}

// A user.key_change item stays in gregor state until the server expires it. Once this device has
// handled it live, a service restart must not handle it again: a restart replays the whole state,
// so a busy key history (device adds, revokes, PUK rolls) would send one KeyfamilyChanged, and for
// the logged-in user one UserChanged to the GUI, per item.
func TestKeyChangeNotReplayedAfterRestart(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	tc.G.SetService()

	// no signup: nobody is logged in, so the handler's revoke check is skipped and needs no server
	uid := gregor1.UID(keybase1.MakeTestUID(1).ToBytes())
	h := newGregorHandler(g)
	h.Init()
	h.testingEvents = newTestingEvents()
	h.PushHandler(newUserHandler(tc.G))
	// handlers dismiss through G's GregorState, which the service points at its gregor handler
	tc.G.GregorState = h
	_, err := h.resetGregorClient(context.TODO(), uid, gregor1.DeviceID{})
	require.NoError(t, err)
	defer h.Shutdown(context.Background())
	server := newGregordMock(tc.G.Log)

	counter := &keyfamilyChangedCounter{}
	tc.G.NotifyRouter.AddListener(counter)

	keyChange := server.newIbm2(uid, "user.key_change", gregor1.Body("{}"))
	require.NoError(t, server.ConsumeMessage(context.TODO(), keyChange))
	require.NoError(t, broadcastMessageTesting(t, h, keyChange))
	require.Equal(t, int32(1), counter.count.Load(), "the live key change is handled once")

	// restart the service: a new handler restores the saved state and does a fresh replay
	require.NoError(t, h.gregorCli.Save(context.TODO()))
	h = newGregorHandler(g)
	h.testingEvents = newTestingEvents()
	h.Init()
	h.PushHandler(newUserHandler(tc.G))
	tc.G.GregorState = h
	_, err = h.resetGregorClient(context.TODO(), uid, gregor1.DeviceID{})
	require.NoError(t, err)

	replayed, _ := doServerSync(t, h, server)
	keyChangeID := keyChange.ToInBandMessage().Metadata().MsgID().String()
	for _, msg := range replayed {
		require.NotEqual(t, keyChangeID, msg.Metadata().MsgID().String(),
			"the restart replayed a key change this device already handled")
	}
	require.Equal(t, int32(1), counter.count.Load(), "the restart handled the key change again")
}
