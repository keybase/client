// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type selfNotifyListener struct {
	libkb.NoopNotifyListener
	sync.Mutex
	userChanged     []keybase1.UID
	trackingChanged []keybase1.UID
}

var _ libkb.NotifyListener = (*selfNotifyListener)(nil)

func (l *selfNotifyListener) UserChanged(uid keybase1.UID) {
	l.Lock()
	defer l.Unlock()
	l.userChanged = append(l.userChanged, uid)
}

func (l *selfNotifyListener) TrackingChanged(uid keybase1.UID, _ libkb.NormalizedUsername) {
	l.Lock()
	defer l.Unlock()
	l.trackingChanged = append(l.trackingChanged, uid)
}

func (l *selfNotifyListener) reset() {
	l.Lock()
	defer l.Unlock()
	l.userChanged = nil
	l.trackingChanged = nil
}

func (l *selfNotifyListener) userChangedUIDs() []keybase1.UID {
	l.Lock()
	defer l.Unlock()
	return append([]keybase1.UID(nil), l.userChanged...)
}

func (l *selfNotifyListener) trackingChangedUIDs() []keybase1.UID {
	l.Lock()
	defer l.Unlock()
	return append([]keybase1.UID(nil), l.trackingChanged...)
}

func setupSelfNotifyTest(t *testing.T, name string) (libkb.TestContext, *FakeUser, *selfNotifyListener) {
	tc := SetupEngineTest(t, name)
	tc.G.SetService()
	fu := CreateAndSignupFakeUser(tc, "snot")
	listener := &selfNotifyListener{}
	tc.G.NotifyRouter.AddListener(listener)
	return tc, fu, listener
}

func TestProfileEditSendsUserChanged(t *testing.T) {
	tc, fu, listener := setupSelfNotifyTest(t, "pe_notify")
	defer tc.Cleanup()

	eng := NewProfileEdit(tc.G, keybase1.ProfileEditArg{Bio: "bio", FullName: "Test User", Location: "Earth"})
	require.NoError(t, RunEngine2(NewMetaContextForTest(tc), eng))
	require.Contains(t, listener.userChangedUIDs(), fu.UID())
}

func TestProveSendsUserChanged(t *testing.T) {
	tc, fu, listener := setupSelfNotifyTest(t, "prove_notify")
	defer tc.Cleanup()

	_, _, err := proveRooter(tc.G, fu, libkb.KeybaseSignatureV2)
	require.NoError(t, err)
	require.Contains(t, listener.userChangedUIDs(), fu.UID())
}

// The proof link is posted before the remote check fails, so the profile
// changed even though the engine returns an error.
func TestProveFailingCheckSendsUserChanged(t *testing.T) {
	tc, fu, listener := setupSelfNotifyTest(t, "prove_fail_notify")
	defer tc.Cleanup()

	_, err := proveRooterFail(tc.G, fu, libkb.KeybaseSignatureV2)
	require.Error(t, err)
	require.Contains(t, listener.userChangedUIDs(), fu.UID())
}

func TestRevokeSigsSendsUserChanged(t *testing.T) {
	tc, fu, listener := setupSelfNotifyTest(t, "revoke_sigs_notify")
	defer tc.Cleanup()

	_, sigID, err := proveRooter(tc.G, fu, libkb.KeybaseSignatureV2)
	require.NoError(t, err)
	listener.reset()

	uis := libkb.UIs{LogUI: tc.G.UI.GetLogUI(), SecretUI: fu.NewSecretUI()}
	eng := NewRevokeSigsEngine(tc.G, []string{sigID.String()})
	require.NoError(t, RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), eng))
	require.Contains(t, listener.userChangedUIDs(), fu.UID())
}

func TestCryptocurrencySendsUserChanged(t *testing.T) {
	tc, fu, listener := setupSelfNotifyTest(t, "crypto_notify")
	defer tc.Cleanup()

	sv := keybase1.SigVersion(libkb.KeybaseSignatureV2)
	uis := libkb.UIs{LogUI: tc.G.UI.GetLogUI(), SecretUI: fu.NewSecretUI()}
	eng := NewCryptocurrencyEngine(tc.G, keybase1.RegisterAddressArg{Address: firstAddress, WantedFamily: "bitcoin", SigVersion: &sv})
	require.NoError(t, RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), eng))
	require.Contains(t, listener.userChangedUIDs(), fu.UID())
}

// A follow or unfollow tells clients about the user followed, once: not about
// the follower, and not again when the next self load finds the link this
// device just posted.
func TestFollowSendsOneTrackingChangedForThem(t *testing.T) {
	tc, fu, listener := setupSelfNotifyTest(t, "follow_notify")
	defer tc.Cleanup()

	alice, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, "t_alice"))
	require.NoError(t, err)

	trackAlice(tc, fu, libkb.KeybaseSignatureV2)
	_, err = libkb.LoadMe(libkb.NewLoadUserArg(tc.G).WithForcePoll(true))
	require.NoError(t, err)
	require.Equal(t, []keybase1.UID{alice.GetUID()}, listener.trackingChangedUIDs())

	listener.reset()
	untrackAlice(tc, fu, libkb.KeybaseSignatureV2)
	_, err = libkb.LoadMe(libkb.NewLoadUserArg(tc.G).WithForcePoll(true))
	require.NoError(t, err)
	require.Equal(t, []keybase1.UID{alice.GetUID()}, listener.trackingChangedUIDs())
}

// lostResponseAPI lets the server take a post to endpoint and then fails the
// call, as when the response is lost on the way back.
type lostResponseAPI struct {
	libkb.API
	endpoint string
}

func (a *lostResponseAPI) Post(m libkb.MetaContext, arg libkb.APIArg) (*libkb.APIRes, error) {
	res, err := a.API.Post(m, arg)
	if err == nil && arg.Endpoint == a.endpoint {
		return nil, errors.New("response lost")
	}
	return res, err
}

func loseResponsesFrom(tc libkb.TestContext, endpoint string) {
	tc.G.API = &lostResponseAPI{API: tc.G.API, endpoint: endpoint}
}

func TestFollowWithLostResponseSendsTrackingChanged(t *testing.T) {
	tc, fu, listener := setupSelfNotifyTest(t, "follow_lost_notify")
	defer tc.Cleanup()

	alice, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, "t_alice"))
	require.NoError(t, err)

	loseResponsesFrom(tc, "follow")
	sv := keybase1.SigVersion(libkb.KeybaseSignatureV2)
	_, _, err = runTrackWithOptions(tc, fu, "t_alice", keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI(), false)
	require.Error(t, err)
	require.Equal(t, []keybase1.UID{alice.GetUID()}, listener.trackingChangedUIDs())
	require.Contains(t, listener.userChangedUIDs(), fu.UID())
}

func TestUnfollowWithLostResponseSendsTrackingChanged(t *testing.T) {
	tc, fu, listener := setupSelfNotifyTest(t, "unfollow_lost_notify")
	defer tc.Cleanup()

	alice, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, "t_alice"))
	require.NoError(t, err)
	trackAlice(tc, fu, libkb.KeybaseSignatureV2)
	listener.reset()

	loseResponsesFrom(tc, "follow")
	require.Error(t, runUntrack(tc, fu, "t_alice", libkb.KeybaseSignatureV2))
	require.Equal(t, []keybase1.UID{alice.GetUID()}, listener.trackingChangedUIDs())
	require.Contains(t, listener.userChangedUIDs(), fu.UID())
}
