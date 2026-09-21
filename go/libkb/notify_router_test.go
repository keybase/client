// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// readSessionOnly stands in for the service's reader: the session straight off
// the active device, read when the clientState is sent.
func readSessionOnly(g *GlobalContext) func(context.Context) keybase1.ClientState {
	return func(context.Context) keybase1.ClientState {
		session := keybase1.ClientSession{LoggedIn: g.ActiveDevice.Valid(), Uid: g.ActiveDevice.UID()}
		return keybase1.ClientState{Session: &session}
	}
}

func clientStates(t *testing.T, rec *NotifyRecorder) []keybase1.ClientState {
	t.Helper()
	var ret []keybase1.ClientState
	for _, m := range rec.Messages() {
		if m.Method != "keybase.1.NotifyApp.clientState" {
			continue
		}
		var arg keybase1.ClientStateArg
		require.NoError(t, m.Decode(&arg))
		ret = append(ret, arg.State)
	}
	return ret
}

// testLoginWrite is the write a provisioning flow makes partway through
// (kex2_provisionee, signup's device_wrap): it leaves a valid session that no
// login has announced yet.
func testLoginWrite(m MetaContext, uid keybase1.UID, name string) error {
	sig, err := GenerateNaclSigningKeyPair()
	if err != nil {
		return err
	}
	enc, err := GenerateNaclDHKeyPair()
	if err != nil {
		return err
	}
	deviceID, err := NewDeviceID()
	if err != nil {
		return err
	}
	uv := keybase1.UserVersion{Uid: uid, EldestSeqno: 1}
	return m.SwitchUserNewConfigActiveDevice(uv, NewNormalizedUsername(name), nil, deviceID,
		sig, enc, "testdevice", KeychainModeNone)
}

func testUID(i int) keybase1.UID {
	return keybase1.UID(fmt.Sprintf("%030x19", i+1))
}

// A write that leaves a valid session is a login still in progress, and the
// client must not see it logged in until that login completes and says so.
func TestProvisionalValidWriteQueuesNoClientState(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	g.NotifyRouter.SetClientStateReader(readSessionOnly(g))
	m := NewMetaContextForTest(tc)

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{App: true, Session: true})
	defer rec.Close()
	rec.Flush()
	require.Len(t, clientStates(t, rec), 1, "the one queued on subscribing")

	require.NoError(t, testLoginWrite(m, testUID(0), "testuser"))
	require.True(t, g.ActiveDevice.Valid())
	rec.Flush()
	require.Len(t, clientStates(t, rec), 1, "nothing for a login that has not completed")

	g.NotifyRouter.SendLogin(context.Background(), "testuser", false)
	rec.Flush()
	states := clientStates(t, rec)
	require.Len(t, states, 2, "the completed login queues one")
	require.True(t, states[1].Session.LoggedIn)
}

// A write that makes the session valid outside any login flow -- a Device
// prereq bootstrapping the active device from the secret store, say -- has no
// SendLogin behind it, so the write itself has to reach clients.
func TestBootstrapStyleWriteQueuesClientState(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	g.NotifyRouter.SetClientStateReader(readSessionOnly(g))
	m := NewMetaContextForTest(tc)

	uid := testUID(0)
	deviceID, err := NewDeviceID()
	require.NoError(t, err)
	require.NoError(t, m.SwitchUserNewConfig(uid, NewNormalizedUsername("testuser"), nil, deviceID))

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{App: true, Session: true})
	defer rec.Close()
	rec.Flush()
	require.Len(t, clientStates(t, rec), 1, "the one queued on subscribing")

	sig, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)
	enc, err := GenerateNaclDHKeyPair()
	require.NoError(t, err)
	require.NoError(t, m.SetActiveDevice(keybase1.UserVersion{Uid: uid, EldestSeqno: 1}, deviceID,
		sig, enc, "testdevice", KeychainModeNone))
	require.True(t, g.ActiveDevice.Valid())
	rec.Flush()
	states := clientStates(t, rec)
	require.Len(t, states, 2, "the write that made the session valid queued one")
	require.True(t, states[1].Session.LoggedIn)
}

// A release that changes nothing about the session has nothing to tell.
func TestUnchangedSessionQueuesNoClientState(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	g.NotifyRouter.SetClientStateReader(readSessionOnly(g))
	m := NewMetaContextForTest(tc)

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{App: true, Session: true})
	defer rec.Close()
	rec.Flush()
	require.Len(t, clientStates(t, rec), 1, "the one queued on subscribing")

	require.False(t, g.ActiveDevice.Valid())
	require.NoError(t, m.SwitchUserLoggedOut())
	rec.Flush()
	require.Len(t, clientStates(t, rec), 1, "logged out before and after")
}

// A clear needs no announce to reach clients: a flow that fails and clears
// what it set, without a logout, still leaves every client logged out.
func TestSessionClearQueuesClientState(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	g.NotifyRouter.SetClientStateReader(readSessionOnly(g))
	m := NewMetaContextForTest(tc)

	require.NoError(t, testLoginWrite(m, testUID(0), "testuser"))
	g.NotifyRouter.SendLogin(context.Background(), "testuser", false)

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{App: true, Session: true})
	defer rec.Close()
	rec.Flush()
	states := clientStates(t, rec)
	require.Len(t, states, 1)
	require.True(t, states[0].Session.LoggedIn)

	require.NoError(t, m.SwitchUserLoggedOut())
	rec.Flush()
	states = clientStates(t, rec)
	require.Len(t, states, 2, "the clear queued one without any announce")
	require.False(t, states[1].Session.LoggedIn)
}

// Logins and logouts are not serialized against each other -- a login writes
// its device under switchUserMu and announces after releasing it -- so their
// loggedIn/loggedOut events can arrive in any order. What must hold anyway is
// that the last clientState every connection gets carries the session as it
// finally is.
func TestLastClientStateCarriesFinalSession(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	g.NotifyRouter.SetClientStateReader(readSessionOnly(g))
	m := NewMetaContextForTest(tc)

	var recs []*NotifyRecorder
	for range 3 {
		rec := NewNotifyRecorder(g, keybase1.NotificationChannels{App: true, Session: true})
		defer rec.Close()
		recs = append(recs, rec)
	}

	ctx := context.Background()
	var wg sync.WaitGroup
	for i := range 6 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range 10 {
				switch (i + j) % 3 {
				case 0:
					name := fmt.Sprintf("testuser%d", i)
					if assert.NoError(t, testLoginWrite(m, testUID(i*10+j), name)) {
						g.NotifyRouter.SendLogin(ctx, name, false)
					}
				case 1:
					assert.NoError(t, m.LogoutKeepSecrets())
				default:
					// a flow that fails and clears what it set, announcing nothing
					assert.NoError(t, m.SwitchUserLoggedOut())
				}
			}
		}()
	}
	wg.Wait()

	want := keybase1.ClientSession{LoggedIn: g.ActiveDevice.Valid(), Uid: g.ActiveDevice.UID()}
	for _, rec := range recs {
		rec.Flush()
		states := clientStates(t, rec)
		require.NotEmpty(t, states)
		require.Equal(t, want, *states[len(states)-1].Session, "connection %d", rec.ID)
	}
}

// A clientState reads the state when it is sent, not when it is queued. That is
// what lets the last one carry the latest session although nothing orders a
// login's write against a logout's announce: whichever clientState is sent last
// reads after every write that queued one.
func TestClientStateReadsWhenSent(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()

	var mu sync.Mutex
	loggedIn := false
	var reads atomic.Int32
	entered := make(chan struct{})
	gate := make(chan struct{})
	g.NotifyRouter.SetClientStateReader(func(context.Context) keybase1.ClientState {
		if reads.Add(1) == 1 {
			close(entered)
			<-gate
		}
		mu.Lock()
		defer mu.Unlock()
		session := keybase1.ClientSession{LoggedIn: loggedIn}
		return keybase1.ClientState{Session: &session}
	})

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{App: true})
	defer rec.Close()
	// the sender is now busy with the first clientState, so the next one waits in the queue
	<-entered
	g.NotifyRouter.AnnounceClientState(context.Background())
	mu.Lock()
	loggedIn = true
	mu.Unlock()
	close(gate)
	rec.Flush()

	states := clientStates(t, rec)
	require.Len(t, states, 2)
	require.True(t, states[1].Session.LoggedIn, "queued before the change, read after it")
}

// A late SetChannels for a connection that has already closed must not bring
// its entry back: nothing would ever remove it again.
func TestSetChannelsAfterCloseRegistersNothing(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	n := g.NotifyRouter

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{App: true})
	rec.Close()
	require.Eventually(t, func() bool {
		n.Lock()
		defer n.Unlock()
		return n.senders[rec.ID] == nil
	}, 5*time.Second, time.Millisecond)

	n.SetChannels(rec.ID, keybase1.NotificationChannels{App: true})
	n.Lock()
	_, registered := n.state[rec.ID]
	n.Unlock()
	require.False(t, registered)
}

// A oneshot device is a login still in progress, like a provisioning write:
// clients must not see it logged in until the login completes and says so.
func TestOneshotDeviceQueuesNoClientState(t *testing.T) {
	tc := SetupTest(t, "NotifyRouter", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	g.NotifyRouter.SetClientStateReader(readSessionOnly(g))
	m := NewMetaContextForTest(tc)

	rec := NewNotifyRecorder(g, keybase1.NotificationChannels{App: true, Session: true})
	defer rec.Close()
	rec.Flush()
	require.Len(t, clientStates(t, rec), 1, "the one queued on subscribing")

	sig, err := GenerateNaclSigningKeyPair()
	require.NoError(t, err)
	enc, err := GenerateNaclDHKeyPair()
	require.NoError(t, err)
	deviceID, err := NewDeviceID()
	require.NoError(t, err)
	uv := keybase1.UserVersion{Uid: testUID(0), EldestSeqno: 1}
	require.NoError(t, m.SwitchUserToActiveOneshotDevice(uv, NewNormalizedUsername("testuser"),
		NewDeviceWithKeys(sig, enc, deviceID, "testdevice", KeychainModeNone)))
	require.True(t, g.ActiveDevice.Valid())
	rec.Flush()
	require.Len(t, clientStates(t, rec), 1, "nothing for a login that has not completed")

	g.NotifyRouter.SendLogin(context.Background(), "testuser", false)
	rec.Flush()
	states := clientStates(t, rec)
	require.Len(t, states, 2, "the completed login queues one")
	require.True(t, states[1].Session.LoggedIn)
}

// A standalone client runs the service without ever setting up a router.
func TestNilRouterSettersAreNoOps(t *testing.T) {
	var n *NotifyRouter
	n.SetClientStateReader(func(context.Context) keybase1.ClientState { return keybase1.ClientState{} })
	n.SetChannels(ConnectionID(1), keybase1.NotificationChannels{App: true})
}
