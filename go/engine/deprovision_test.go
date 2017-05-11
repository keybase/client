// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func assertFileExists(t testing.TB, path string) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatalf("%s unexpectedly does not exist", path)
	}
}

func assertFileDoesNotExist(t testing.TB, path string) {
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
	loaded, err := libkb.LoadUser(libkb.LoadUserArg{Name: fu.Username, ForceReload: true})
	if err != nil {
		tc.T.Fatal(err)
	}
	ckf := loaded.GetComputedKeyFamily()
	return len(ckf.GetAllActiveSibkeys()) + len(ckf.GetAllActiveSubkeys())
}

func assertDeprovisionWithSetup(tc libkb.TestContext, makeAndRevokePaperKey bool) {
	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	arg.StoreSecret = tc.G.SecretStoreAll != nil
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(&arg, tc.G)
	err := RunEngine(s, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}

	if tc.G.SecretStoreAll != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret()
		if err != nil {
			tc.T.Fatal(err)
		}
	}

	dbPath := tc.G.Env.GetDbFilename()
	sessionPath := tc.G.Env.GetSessionFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)

	assertFileExists(tc.T, dbPath)
	assertFileExists(tc.T, sessionPath)
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

	if makeAndRevokePaperKey {
		t := tc.T
		t.Logf("generate a paper key")
		ctx := &Context{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
			SecretUI: &libkb.TestSecretUI{},
		}
		eng := NewPaperKey(tc.G)
		err := RunEngine(eng, ctx)
		require.NoError(t, err)
		require.NotEqual(t, 0, len(eng.Passphrase()), "empty passphrase")

		t.Logf("revoke a paper key")
		devices, _ := getActiveDevicesAndKeys(tc, fu)
		var revokeDevice *libkb.Device
		for _, device := range devices {
			if device.Type == libkb.DeviceTypePaper {
				revokeDevice = device
			}
		}
		t.Logf("revoke %s", revokeDevice.ID)
		err = doRevokeDevice(tc, fu, revokeDevice.ID, false)
		require.NoError(t, err)
	}

	e := NewDeprovisionEngine(tc.G, fu.Username, true /* doRevoke */)
	ctx = &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	if err := RunEngine(e, ctx); err != nil {
		tc.T.Fatal(err)
	}

	if LoggedIn(tc) {
		tc.T.Error("Unexpectedly still logged in")
	}

	if tc.G.SecretStoreAll != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret()
		if err == nil {
			tc.T.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(tc.T, dbPath)
	assertFileDoesNotExist(tc.T, sessionPath)
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

func TestDeprovision(t *testing.T) {
	testDeprovision(t, false)
}

func TestDeprovisionPUK(t *testing.T) {
	testDeprovision(t, true)
}

func testDeprovision(t *testing.T, upgradePerUserKey bool) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()
	tc.Tp.UpgradePerUserKey = upgradePerUserKey
	if tc.G.SecretStoreAll == nil {
		t.Fatal("Need a secret store for this test")
	}
	assertDeprovisionWithSetup(tc, false)

	// Now, test deprovision codepath with no secret store
	tc.G.SecretStoreAll = nil
	assertDeprovisionWithSetup(tc, false)
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
	tc.Tp.UpgradePerUserKey = upgradePerUserKey
	if tc.G.SecretStoreAll == nil {
		t.Fatal("Need a secret store for this test")
	}
	assertDeprovisionWithSetup(tc, true)

	// Now, test deprovision codepath with no secret store
	tc.G.SecretStoreAll = nil
	assertDeprovisionWithSetup(tc, true)
}

func assertDeprovisionLoggedOut(tc libkb.TestContext) {

	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)

	arg.StoreSecret = tc.G.SecretStoreAll != nil
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(&arg, tc.G)
	err := RunEngine(s, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}

	if tc.G.SecretStoreAll != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret()
		if err != nil {
			tc.T.Fatal(err)
		}
	}

	dbPath := tc.G.Env.GetDbFilename()
	sessionPath := tc.G.Env.GetSessionFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)

	assertFileExists(tc.T, dbPath)
	assertFileExists(tc.T, sessionPath)
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
	tc.G.Logout()

	e := NewDeprovisionEngine(tc.G, fu.Username, false /* doRevoke */)
	ctx = &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	if err := RunEngine(e, ctx); err != nil {
		tc.T.Fatal(err)
	}

	if LoggedIn(tc) {
		tc.T.Error("Unexpectedly still logged in")
	}

	if tc.G.SecretStoreAll != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret()
		if err == nil {
			tc.T.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(tc.T, dbPath)
	assertFileDoesNotExist(tc.T, sessionPath)
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
	if tc.G.SecretStoreAll == nil {
		t.Fatalf("Need a secret store for this test")
	}
	assertDeprovisionLoggedOut(tc)

	// Now, test codepath with no secret store
	tc.G.SecretStoreAll = nil
	assertDeprovisionLoggedOut(tc)
}

func assertCurrentDeviceRevoked(tc libkb.TestContext) {

	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	arg.StoreSecret = tc.G.SecretStoreAll != nil
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(&arg, tc.G)
	err := RunEngine(s, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}

	if tc.G.SecretStoreAll != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret()
		if err != nil {
			tc.T.Fatal(err)
		}
	}

	dbPath := tc.G.Env.GetDbFilename()
	sessionPath := tc.G.Env.GetSessionFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)

	assertFileExists(tc.T, dbPath)
	assertFileExists(tc.T, sessionPath)
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
	err = doRevokeDevice(tc, fu, tc.G.Env.GetDeviceID(), true /* force */)
	if err != nil {
		tc.T.Fatal(err)
	}

	e := NewDeprovisionEngine(tc.G, fu.Username, true /* doRevoke */)
	ctx = &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	if err := RunEngine(e, ctx); err != nil {
		tc.T.Fatal(err)
	}

	if LoggedIn(tc) {
		tc.T.Error("Unexpectedly still logged in")
	}

	if tc.G.SecretStoreAll != nil {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret()
		if err == nil {
			tc.T.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(tc.T, dbPath)
	assertFileDoesNotExist(tc.T, sessionPath)
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
	if tc.G.SecretStoreAll == nil {
		t.Fatalf("Need a secret store for this test")
	}
	assertCurrentDeviceRevoked(tc)

	// Now, test codepath with no secret store
	tc.G.SecretStoreAll = nil
	assertCurrentDeviceRevoked(tc)
}
