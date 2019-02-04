// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func forceOpenDBs(tc libkb.TestContext) {
	// We need to ensure these dbs are open since we test that we can delete
	// them on deprovision
	err := tc.G.LocalDb.ForceOpen()
	require.NoError(tc.T, err)
	err = tc.G.LocalChatDb.ForceOpen()
	require.NoError(tc.T, err)
}

func assertFileExists(t libkb.TestingTB, path string) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatalf("%s unexpectedly does not exist", path)
	}
}

func assertFileDoesNotExist(t libkb.TestingTB, path string) {
	if _, err := os.Stat(path); err == nil {
		t.Fatalf("%s unexpectedly exists", path)
	}
}

func isUserInConfigFile(tc libkb.TestContext, fu FakeUser) bool {
	_, err := tc.G.Env.GetConfig().GetUserConfigForUsername(fu.NormalizedUsername())
	return err == nil
}

func isUserConfigInMemory(tc libkb.TestContext) bool {
	config, _ := tc.G.Env.GetConfig().GetUserConfig()
	return config != nil
}

func getNumKeys(tc libkb.TestContext, fu FakeUser) int {
	loaded, err := libkb.LoadUser(libkb.NewLoadUserArg(tc.G).WithName(fu.Username).WithForceReload())
	if err != nil {
		switch err.(type) {
		case libkb.NoKeyError:
			return 0
		default:
			require.NoError(tc.T, err)
		}
	}
	ckf := loaded.GetComputedKeyFamily()
	return len(ckf.GetAllActiveSibkeys()) + len(ckf.GetAllActiveSubkeys())
}

type assertDeprovisionWithSetupArg struct {
	// create and then revoke one extra paper key
	makeAndRevokePaperKey bool

	// revoke the final paper key
	revokePaperKey bool
}

func assertDeprovisionWithSetup(tc libkb.TestContext, targ assertDeprovisionWithSetupArg) *FakeUser {
	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	arg.StoreSecret = tc.G.SecretStore() != nil
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, &arg)
	err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s)
	if err != nil {
		tc.T.Fatal(err)
	}

	m := NewMetaContextForTest(tc)
	if tc.G.SecretStore() != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret(m)
		if err != nil {
			tc.T.Fatal(err)
		}
	}

	forceOpenDBs(tc)
	dbPath := tc.G.Env.GetDbFilename()
	chatDBPath := tc.G.Env.GetChatDbFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)
	expectedNumKeys := numKeys

	assertFileExists(tc.T, dbPath)
	assertFileExists(tc.T, chatDBPath)
	assertFileExists(tc.T, secretKeysPath)
	if !isUserInConfigFile(tc, *fu) {
		tc.T.Fatalf("User %s is not in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if !isUserConfigInMemory(tc) {
		tc.T.Fatal("user config is not in memory")
	}

	if !LoggedIn(tc) {
		tc.T.Fatal("Unexpectedly logged out")
	}

	if targ.makeAndRevokePaperKey {
		t := tc.T
		t.Logf("generate a paper key (targ)")
		uis := libkb.UIs{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := NewPaperKey(tc.G)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := RunEngine2(m, eng)
		require.NoError(t, err)
		require.NotEqual(t, 0, len(eng.Passphrase()), "empty passphrase")

		revokeAnyPaperKey(tc, fu)
	}

	if targ.revokePaperKey {
		tc.T.Logf("revoking paper key (targ)")
		revokeAnyPaperKey(tc, fu)
		expectedNumKeys -= 2
	}

	e := NewDeprovisionEngine(tc.G, fu.Username, true /* doRevoke */)
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	m = m.WithUIs(uis)
	if err := RunEngine2(m, e); err != nil {
		tc.T.Fatal(err)
	}
	expectedNumKeys -= 2

	if LoggedIn(tc) {
		tc.T.Error("Unexpectedly still logged in")
	}

	if tc.G.SecretStore() != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret(m)
		if err == nil {
			tc.T.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(tc.T, dbPath)
	assertFileDoesNotExist(tc.T, chatDBPath)
	assertFileDoesNotExist(tc.T, secretKeysPath)

	if isUserInConfigFile(tc, *fu) {
		tc.T.Fatalf("User %s is still in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if isUserConfigInMemory(tc) {
		tc.T.Fatal("user config is still in memory")
	}

	newKeys := getNumKeys(tc, *fu)
	require.Equal(tc.T, expectedNumKeys, newKeys, "unexpected number of keys (failed to revoke device keys)")

	return fu
}

func TestDeprovision(t *testing.T) {
	testDeprovision(t, false)
}

func TestDeprovisionPUK(t *testing.T) {
	testDeprovision(t, true)
}

func testDeprovision(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()
	tc.Tp.DisableUpgradePerUserKey = !upgradePerUserKey
	if tc.G.SecretStore() == nil {
		t.Fatal("Need a secret store for this test")
	}
	assertDeprovisionWithSetup(tc, assertDeprovisionWithSetupArg{})
}

func TestDeprovisionAfterRevokePaper(t *testing.T) {
	testDeprovisionAfterRevokePaper(t, false)
}

func TestDeprovisionAfterRevokePaperPUK(t *testing.T) {
	testDeprovisionAfterRevokePaper(t, true)
}

func testDeprovisionAfterRevokePaper(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()

	tc.Tp.DisableUpgradePerUserKey = !upgradePerUserKey
	if tc.G.SecretStore() == nil {
		t.Fatal("Need a secret store for this test")
	}
	assertDeprovisionWithSetup(tc, assertDeprovisionWithSetupArg{
		makeAndRevokePaperKey: true,
	})
}

func assertDeprovisionLoggedOut(tc libkb.TestContext) {

	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)

	arg.StoreSecret = tc.G.SecretStore() != nil
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, &arg)
	err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s)
	if err != nil {
		tc.T.Fatal(err)
	}

	m := NewMetaContextForTest(tc)
	if tc.G.SecretStore() != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret(m)
		if err != nil {
			tc.T.Fatal(err)
		}
	}

	forceOpenDBs(tc)
	dbPath := tc.G.Env.GetDbFilename()
	chatDBPath := tc.G.Env.GetChatDbFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)

	assertFileExists(tc.T, dbPath)
	assertFileExists(tc.T, chatDBPath)
	assertFileExists(tc.T, secretKeysPath)
	if !isUserInConfigFile(tc, *fu) {
		tc.T.Fatalf("User %s is not in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if !isUserConfigInMemory(tc) {
		tc.T.Fatalf("user config is not in memory")
	}

	if !LoggedIn(tc) {
		tc.T.Fatal("Unexpectedly logged out")
	}

	// Unlike the first test, this time we log out before we run the
	// deprovision. We should be able to do a deprovision with revocation
	// disabled.
	tc.G.Logout(context.TODO())

	e := NewDeprovisionEngine(tc.G, fu.Username, false /* doRevoke */)
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	m = m.WithUIs(uis)
	if err := RunEngine2(m, e); err != nil {
		tc.T.Fatal(err)
	}

	if LoggedIn(tc) {
		tc.T.Error("Unexpectedly still logged in")
	}

	if tc.G.SecretStore() != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret(m)
		if err == nil {
			tc.T.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(tc.T, dbPath)
	assertFileDoesNotExist(tc.T, chatDBPath)
	assertFileDoesNotExist(tc.T, secretKeysPath)
	if isUserInConfigFile(tc, *fu) {
		tc.T.Fatalf("User %s is still in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if isUserConfigInMemory(tc) {
		tc.T.Fatalf("user config is still in memory")
	}

	newNumKeys := getNumKeys(tc, *fu)
	if newNumKeys != numKeys {
		tc.T.Fatalf("expected the same number of device keys, before: %d, after: %d", numKeys, newNumKeys)
	}
}

func TestDeprovisionLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()
	if tc.G.SecretStore() == nil {
		t.Fatalf("Need a secret store for this test")
	}
	assertDeprovisionLoggedOut(tc)
}

func assertCurrentDeviceRevoked(tc libkb.TestContext) {

	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	arg.StoreSecret = tc.G.SecretStore() != nil
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, &arg)
	err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s)
	if err != nil {
		tc.T.Fatal(err)
	}

	if tc.G.SecretStore() != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret(NewMetaContextForTest(tc))
		if err != nil {
			tc.T.Fatal(err)
		}
	}

	forceOpenDBs(tc)
	dbPath := tc.G.Env.GetDbFilename()
	chatDBPath := tc.G.Env.GetChatDbFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)

	assertFileExists(tc.T, dbPath)
	assertFileExists(tc.T, chatDBPath)
	assertFileExists(tc.T, secretKeysPath)
	if !isUserInConfigFile(tc, *fu) {
		tc.T.Fatalf("User %s is not in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if !isUserConfigInMemory(tc) {
		tc.T.Fatal("user config is not in memory")
	}

	if !LoggedIn(tc) {
		tc.T.Fatal("Unexpectedly logged out")
	}

	// Revoke the current device! This will cause an error when deprovision
	// tries to revoke the device again, but deprovision should carry on.
	err = doRevokeDevice(tc, fu, tc.G.Env.GetDeviceID(), true /* force */, false /* forceLast */)
	if err != nil {
		tc.T.Fatal(err)
	}

	e := NewDeprovisionEngine(tc.G, fu.Username, true /* doRevoke */)
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, e); err != nil {
		tc.T.Fatal(err)
	}

	if LoggedIn(tc) {
		tc.T.Error("Unexpectedly still logged in")
	}

	if tc.G.SecretStore() != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret(NewMetaContextForTest(tc))
		if err == nil {
			tc.T.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(tc.T, dbPath)
	assertFileDoesNotExist(tc.T, chatDBPath)
	assertFileDoesNotExist(tc.T, secretKeysPath)
	if isUserInConfigFile(tc, *fu) {
		tc.T.Fatalf("User %s is still in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if isUserConfigInMemory(tc) {
		tc.T.Fatal("user config is still in memory")
	}

	newNumKeys := getNumKeys(tc, *fu)
	if newNumKeys != numKeys-2 {
		tc.T.Fatalf("failed to revoke device keys, before: %d, after: %d", numKeys, newNumKeys)
	}
}

func TestCurrentDeviceRevoked(t *testing.T) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()

	if tc.G.SecretStore() == nil {
		t.Fatalf("Need a secret store for this test")
	}
	assertCurrentDeviceRevoked(tc)
}

func TestDeprovisionLastDevice(t *testing.T) {
	testDeprovisionLastDevice(t, false)
}

func TestDeprovisionLastDevicePUK(t *testing.T) {
	testDeprovisionLastDevice(t, true)
}

// A user should be able to revoke all of their devices.
func testDeprovisionLastDevice(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()

	tc.Tp.DisableUpgradePerUserKey = !upgradePerUserKey
	if tc.G.SecretStore() == nil {
		t.Fatal("Need a secret store for this test")
	}
	fu := assertDeprovisionWithSetup(tc, assertDeprovisionWithSetupArg{
		revokePaperKey: true,
	})
	assertNumDevicesAndKeys(tc, fu, 0, 0)
}
