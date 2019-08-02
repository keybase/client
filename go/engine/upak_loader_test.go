// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// There are two test files by this name. One in libkb, one in engine.

package engine

import (
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestLoadDeviceKeyNew(t *testing.T) {
	tc := SetupEngineTest(t, "clu")
	defer tc.Cleanup()

	t.Logf("create new user")
	fu := NewFakeUserOrBust(t, "paper")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	loginUI := &paperLoginUI{Username: fu.Username}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(tc.G, &arg)
	err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s)
	if err != nil {
		tc.T.Fatal(err)
	}
	t.Logf("using username:%+v", fu.Username)
	loadArg := libkb.NewLoadUserByNameArg(tc.G, fu.Username).WithPublicKeyOptional()
	user, err := libkb.LoadUser(loadArg)
	if err != nil {
		tc.T.Fatal(err)
	}
	t.Logf("using username:%+v uid: %+v", user.GetNormalizedName(), user.GetUID())

	assertNumDevicesAndKeys(tc, fu, 2, 4)

	devices, _ := getActiveDevicesAndKeys(tc, fu)
	var device1 *libkb.Device
	for _, device := range devices {
		if device.Type != libkb.DeviceTypePaper {
			device1 = device
		}
	}
	require.NotNil(t, device1, "device1 should be non-nil")
	t.Logf("using device1:%+v", device1.ID)

	t.Logf("load existing device key")
	upk, deviceKey, revoked, err := tc.G.GetUPAKLoader().LoadDeviceKey(context.TODO(), user.GetUID(), device1.ID)
	require.NoError(t, err)
	require.Equal(t, user.GetNormalizedName().String(), upk.Base.Username, "usernames must match")
	require.Equal(t, device1.ID, deviceKey.DeviceID, "deviceID must match")
	require.Equal(t, *device1.Description, deviceKey.DeviceDescription, "device name must match")
	require.Nil(t, revoked, "device not revoked")
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		dev, err := u.GetDevice(device1.ID)
		require.NoError(t, err)
		require.NotNil(t, dev)
		return nil
	})

	Logout(tc)

	if len(loginUI.PaperPhrase) == 0 {
		t.Fatal("login ui has no paper key phrase")
	}

	t.Logf("create new device")
	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	secUI := fu.NewSecretUI()
	provUI := newTestProvisionUIPaper()
	provLoginUI := &libkb.TestLoginUI{Username: fu.Username}
	uis = libkb.UIs{
		ProvisionUI: provUI,
		LogUI:       tc2.G.UI.GetLogUI(),
		SecretUI:    secUI,
		LoginUI:     provLoginUI,
		GPGUI:       &gpgtestui{},
	}

	eng := NewPaperProvisionEngine(tc2.G, fu.Username, "fakedevice", loginUI.PaperPhrase)
	m := NewMetaContextForTest(tc2).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	t.Logf("d2 provisioned (1)")

	testUserHasDeviceKey(tc2)
	require.NoError(t, AssertProvisioned(tc2))
	t.Logf("d2 provisioned (2)")

	devices, _ = getActiveDevicesAndKeys(tc, fu)
	var device2 *libkb.Device
	for _, device := range devices {
		if device.Type != libkb.DeviceTypePaper && device.ID != device1.ID {
			device2 = device
		}
	}
	require.NotNil(t, device2, "device2 should be non-nil")
	t.Logf("using device2:%+v", device2.ID)

	t.Logf("load brand new device (while old is cached)")
	upk, deviceKey, revoked, err = tc.G.GetUPAKLoader().LoadDeviceKey(context.TODO(), user.GetUID(), device2.ID)
	require.NoError(t, err)
	require.Equal(t, user.GetNormalizedName().String(), upk.Base.Username, "usernames must match")
	require.Equal(t, device2.ID, deviceKey.DeviceID, "deviceID must match")
	require.Equal(t, *device2.Description, deviceKey.DeviceDescription, "device name must match")
	require.Nil(t, revoked, "device not revoked")
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		dev, err := u.GetDevice(deviceKey.DeviceID)
		require.NoError(t, err)
		require.NotNil(t, dev)
		return nil
	})
}

func TestLoadDeviceKeyRevoked(t *testing.T) {
	tc := SetupEngineTest(t, "clu")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUserPaper(tc, "rev")
	t.Logf("using username:%+v", fu.Username)
	loadArg := libkb.NewLoadUserByNameArg(tc.G, fu.Username).WithPublicKeyOptional()
	user, err := libkb.LoadUser(loadArg)
	if err != nil {
		tc.T.Fatal(err)
	}
	t.Logf("using username:%+v uid: %+v", user.GetNormalizedName(), user.GetUID())

	assertNumDevicesAndKeys(tc, fu, 2, 4)

	devices, _ := getActiveDevicesAndKeys(tc, fu)
	var thisDevice *libkb.Device
	for _, device := range devices {
		if device.Type != libkb.DeviceTypePaper {
			thisDevice = device
		}
	}

	// Revoke the current device with --force
	err = doRevokeDevice(tc, fu, thisDevice.ID, true, false)
	if err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(tc, fu, 1, 2)

	t.Logf("load revoked device")
	upk, deviceKey, revoked, err := tc.G.GetUPAKLoader().LoadDeviceKey(context.TODO(), user.GetUID(), thisDevice.ID)
	require.NoError(t, err)
	require.Equal(t, user.GetNormalizedName().String(), upk.Base.Username, "usernames must match")
	require.Equal(t, thisDevice.ID, deviceKey.DeviceID, "deviceID must match")
	require.Equal(t, *thisDevice.Description, deviceKey.DeviceDescription, "device name must match")
	require.NotNil(t, revoked, "device should be revoked")
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		dev, err := u.GetDevice(deviceKey.DeviceID)
		require.NoError(t, err)
		require.NotNil(t, dev)
		require.False(t, dev.IsActive())
		dev, err = u.GetDevice(thisDevice.ID)
		require.NoError(t, err)
		require.NotNil(t, dev)
		return nil
	})
}

func TestFullSelfCacherFlushSingleMachine(t *testing.T) {
	tc := SetupEngineTest(t, "fsc")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	fu := CreateAndSignupFakeUser(tc, "fsc")

	var scv keybase1.Seqno
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		require.NotNil(t, u)
		scv = u.GetSigChainLastKnownSeqno()
		return nil
	})
	trackAlice(tc, fu, sigVersion)
	defer untrackAlice(tc, fu, sigVersion)
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		require.NotNil(t, u)
		require.True(t, u.GetSigChainLastKnownSeqno() > scv)
		return nil
	})
}

func TestFullSelfCacherFlushTwoMachines(t *testing.T) {
	tc := SetupEngineTest(t, "fsc")
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	t.Logf("create new user")
	fu := NewFakeUserOrBust(t, "paper")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	loginUI := &paperLoginUI{Username: fu.Username}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(tc.G, &arg)
	err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s)
	if err != nil {
		tc.T.Fatal(err)
	}
	t.Logf("using username:%+v", fu.Username)

	var scv keybase1.Seqno
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		require.NotNil(t, u)
		scv = u.GetSigChainLastKnownSeqno()
		return nil
	})

	if len(loginUI.PaperPhrase) == 0 {
		t.Fatal("login ui has no paper key phrase")
	}

	t.Logf("create new device")
	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	secUI := fu.NewSecretUI()
	provUI := newTestProvisionUIPaper()
	provLoginUI := &libkb.TestLoginUI{Username: fu.Username}
	uis = libkb.UIs{
		ProvisionUI: provUI,
		LogUI:       tc2.G.UI.GetLogUI(),
		SecretUI:    secUI,
		LoginUI:     provLoginUI,
		GPGUI:       &gpgtestui{},
	}

	eng := NewPaperProvisionEngine(tc2.G, fu.Username, "fakedevice", loginUI.PaperPhrase)
	m := NewMetaContextForTest(tc2).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	t.Logf("d2 provisioned (1)")

	// Without pubsub (not available on engine tests), we don't get any
	// invalidation of the user on the first machine (tc). So this
	// user's sigchain should stay the same.
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		require.NotNil(t, u)
		require.True(t, u.GetSigChainLastKnownSeqno() == scv)
		return nil
	})

	// After the CachedUserTimeout, the FullSelfer ought to repoll.
	// Check that the sigchain is updated after the repoll, which reflects
	// the new device having been added.
	fakeClock.Advance(libkb.CachedUserTimeout + time.Second)
	tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
		require.NotNil(t, u)
		require.True(t, u.GetSigChainLastKnownSeqno() > scv)
		return nil
	})
}

func TestUPAKDeadlock(t *testing.T) {
	tc := SetupEngineTest(t, "upak")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUserPaper(tc, "upak")

	// First clear the cache
	tc.G.KeyfamilyChanged(context.TODO(), fu.UID())

	var wg sync.WaitGroup

	ch := make(chan struct{})

	tc.G.GetFullSelfer().(*libkb.CachedFullSelf).TestDeadlocker = func() {
		<-ch
	}

	tc.G.GetUPAKLoader().(*libkb.CachedUPAKLoader).TestDeadlocker = func() {
		ch <- struct{}{}
	}

	wg.Add(1)
	go func() {
		tc.G.GetFullSelfer().WithSelf(context.TODO(), func(u *libkb.User) error {
			require.Equal(t, u.GetUID(), fu.UID(), "right UID")
			return nil
		})
		wg.Done()
	}()

	wg.Add(1)
	go func() {
		un, err := tc.G.GetUPAKLoader().LookupUsername(context.TODO(), fu.UID())
		require.NoError(t, err)
		if un.String() != fu.Username {
			t.Errorf("username mismatch: %s != %s", un, fu.Username)
		}
		wg.Done()
	}()

	doneCh := make(chan struct{})
	go func() {
		wg.Wait()
		doneCh <- struct{}{}
	}()

	select {
	case <-doneCh:
		break
	case <-time.After(20 * time.Second):
		t.Fatal("deadlocked!")
	}
}

func TestLoadAfterAcctReset1(t *testing.T) {
	// One context for user that will be doing LoadUser, and another
	// for user that will sign up and reset itself.
	tc := SetupEngineTest(t, "clu")
	defer tc.Cleanup()

	resetUserTC := SetupEngineTest(t, "clu2")
	defer resetUserTC.Cleanup()

	t.Logf("create new user")
	fu := CreateAndSignupFakeUser(resetUserTC, "res")

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	loadUpak := func() error {
		t.Logf("loadUpak: using username:%+v", fu.Username)
		loadArg := libkb.NewLoadUserArg(tc.G).WithUID(fu.UID()).WithNetContext(context.TODO()).WithStaleOK(false).WithForceMerkleServerPolling(true)

		upak, _, err := tc.G.GetUPAKLoader().Load(loadArg)
		if err != nil {
			return err
		}

		t.Logf("loadUpak done: using username:%+v uid: %+v keys: %d", upak.Base.Username, upak.Base.Uid, len(upak.Base.DeviceKeys))
		return nil
	}

	err := loadUpak()
	if err != nil {
		t.Fatalf("Failed to load user: %+v", err)
	}

	ResetAccount(resetUserTC, fu)

	loadUpakExpectFailure := func() {
		err := loadUpak()
		if err == nil {
			t.Fatalf("Expected UPAKLoader.Load to fail on nuked account.")
		} else if _, ok := err.(libkb.NoKeyError); !ok {
			t.Fatalf("Expected UPAKLoader.Load to fail with NoKeyError, instead failed with: %+v", err)
		}
	}

	// advance the clock past the cache timeout
	fakeClock.Advance(libkb.CachedUserTimeout * 10)
	loadUpakExpectFailure()

	// Try again, see if still errors out (this time user should not
	// be in cache at all).
	fakeClock.Advance(libkb.CachedUserTimeout * 10)
	loadUpakExpectFailure()
}

func TestLoadAfterAcctReset2(t *testing.T) {
	// One context for user that will be doing LoadUser, and another
	// for user that will sign up and reset itself.
	tc := SetupEngineTest(t, "clu")
	defer tc.Cleanup()

	resetUserTC := SetupEngineTest(t, "clu2")
	defer resetUserTC.Cleanup()

	t.Logf("create new user")
	fu := CreateAndSignupFakeUser(resetUserTC, "res")

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	loadUpak := func() (*keybase1.UserPlusAllKeys, error) {
		t.Logf("loadUpak: using username:%+v", fu.Username)
		loadArg := libkb.NewLoadUserArg(tc.G).WithUID(fu.UID()).WithPublicKeyOptional().WithNetContext(context.TODO()).WithStaleOK(false)
		upak, _, err := tc.G.GetUPAKLoader().Load(loadArg)
		if err != nil {
			return nil, err
		}

		t.Logf("loadUpak done: using username:%+v uid: %+v keys: %d", upak.Base.Username, upak.Base.Uid, len(upak.Base.DeviceKeys))
		return upak, nil
	}

	upak1, err := loadUpak()
	if err != nil {
		t.Fatalf("Failed to load user: %+v", err)
	}

	// Reset account and then login again to establish new eldest and
	// add new device keys.
	ResetAccount(resetUserTC, fu)
	tcp := SetupEngineTest(t, "login")
	defer tcp.Cleanup()

	fu.LoginOrBust(tcp)
	if err := AssertProvisioned(tcp); err != nil {
		t.Fatal(err)
	}

	fakeClock.Advance(libkb.CachedUserTimeout * 10)
	upak2, err := loadUpak()
	if err != nil {
		t.Fatalf("Failed to load user after reset+login with: %+v", err)
	}

	if upak1.Base.DeviceKeys[0].KID == upak2.Base.DeviceKeys[0].KID {
		t.Fatal("Found old device key after LoadUser.")
	}
}

// Test the bug in CORE-6943: after a reset, if we did two
// logins in a row, right on top of each other, previous subchains
// would be dropped from the self UPAK.
func TestLoadAfterAcctResetCORE6943(t *testing.T) {
	tc := SetupEngineTest(t, "clu")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	t.Logf("create new user")
	fu := CreateAndSignupFakeUser(tc, "res")

	trackAlice(tc, fu, sigVersion)

	loadUpak := func() (*keybase1.UserPlusAllKeys, error) {
		t.Logf("loadUpak: using username:%+v", fu.Username)
		loadArg := libkb.NewLoadUserArg(tc.G).WithUID(fu.UID()).WithPublicKeyOptional().WithNetContext(context.TODO()).WithStaleOK(false)
		upak, _, err := tc.G.GetUPAKLoader().Load(loadArg)
		if err != nil {
			return nil, err
		}

		t.Logf("loadUpak done: using username:%+v uid: %+v keys: %d", upak.Base.Username, upak.Base.Uid, len(upak.Base.DeviceKeys))
		return upak, nil
	}

	upak1, err := loadUpak()
	if err != nil {
		t.Fatalf("Failed to load user: %+v", err)
	}

	// Reset account and then login again to establish new eldest and
	// add new device keys.
	ResetAccount(tc, fu)

	tc.G.GetUPAKLoader().Invalidate(context.TODO(), fu.UID())

	fu.LoginOrBust(tc)
	if err := AssertProvisioned(tc); err != nil {
		t.Fatal(err)
	}
	// login a second time to force the bug.
	fu.LoginOrBust(tc)

	// Make sure that we can load the eldest key from the previous subchain
	_, _, _, err = tc.G.GetUPAKLoader().LoadKeyV2(context.TODO(), fu.UID(), upak1.Base.DeviceKeys[0].KID)

	if err != nil {
		t.Fatal("Failed to load a UID/KID combo from first incarnation")
	}

	_, err = loadUpak()
	if err != nil {
		t.Fatalf("Failed to load user: %+v", err)
	}
}

func TestUPAKUnstub(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "first")
	Logout(tc)
	u2 := CreateAndSignupFakeUser(tc, "secon")

	testTrack(t, tc, libkb.KeybaseSignatureV2, "t_alice")
	testTrack(t, tc, libkb.KeybaseSignatureV2, u1.Username)

	// The last link is always unstubbed, so this is a throw-away so that we have some links that
	// are stubbed (the two just above).
	testTrack(t, tc, libkb.KeybaseSignatureV2, "t_bob")

	Logout(tc)
	t.Logf("first logging back in")
	u1.LoginOrBust(tc)

	upl := tc.G.GetUPAKLoader()
	mctx := NewMetaContextForTest(tc)

	// wipe out all the caches
	tc.G.LocalDb.Nuke()
	upl.Invalidate(mctx.Ctx(), u2.UID())

	assertStubbed := func() {
		arg := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(u2.UID())
		upak, _, err := upl.LoadV2(arg)
		require.NoError(t, err)
		require.Equal(t, 1, len(upak.Current.RemoteTracks))
		require.Equal(t, "t_bob", upak.Current.RemoteTracks[keybase1.UID("afb5eda3154bc13c1df0189ce93ba119")].Username)
		require.False(t, upak.Current.Unstubbed)
	}

	assertStubbed()

	Logout(tc)
	t.Logf("second logging back in")
	u2.LoginOrBust(tc)

	assertStubbed()

	assertAllLinks := func(stubMode libkb.StubMode) {
		arg := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(u2.UID()).WithStubMode(stubMode)
		upak, _, err := upl.LoadV2(arg)
		require.NoError(t, err)
		require.Equal(t, 3, len(upak.Current.RemoteTracks))
		require.Equal(t, u1.Username, upak.Current.RemoteTracks[u1.UID()].Username)
		require.True(t, upak.Current.Unstubbed)
	}

	assertAllLinks(libkb.StubModeUnstubbed)

	Logout(tc)
	t.Logf("first logging back in")
	u1.LoginOrBust(tc)

	assertAllLinks(libkb.StubModeUnstubbed)
	assertAllLinks(libkb.StubModeStubbed)
}
