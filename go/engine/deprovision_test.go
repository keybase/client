// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func assertFileExists(t *testing.T, path string) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatalf("%s unexpectedly does not exist", path)
	}
}

func assertFileDoesNotExist(t *testing.T, path string) {
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

func TestDeprovision(t *testing.T) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()

	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = libkb.HasSecretStore()
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

	if libkb.HasSecretStore() {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret()
		if err != nil {
			t.Fatal(err)
		}
	}

	dbPath := tc.G.Env.GetDbFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)

	assertFileExists(t, dbPath)
	assertFileExists(t, secretKeysPath)
	if !isUserInConfigFile(tc, *fu) {
		t.Fatalf("User %s is not in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if !isUserConfigInMemory(tc) {
		t.Fatalf("user config is not in memory")
	}

	if !LoggedIn(tc) {
		t.Fatal("Unexpectedly logged out")
	}

	e := NewDeprovisionEngine(tc.G, fu.Username, true /* doRevoke */)
	ctx = &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	if err := RunEngine(e, ctx); err != nil {
		t.Fatal(err)
	}

	if LoggedIn(tc) {
		t.Error("Unexpectedly still logged in")
	}

	if libkb.HasSecretStore() {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret()
		if err == nil {
			t.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(t, dbPath)
	assertFileDoesNotExist(t, secretKeysPath)
	if isUserInConfigFile(tc, *fu) {
		t.Fatalf("User %s is still in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if isUserConfigInMemory(tc) {
		t.Fatalf("user config is still in memory")
	}

	newNumKeys := getNumKeys(tc, *fu)
	if newNumKeys != numKeys-2 {
		t.Fatalf("failed to revoke device keys, before: %d, after: %d", numKeys, newNumKeys)
	}
}

func TestDeprovisionLoggedOut(t *testing.T) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()

	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = libkb.HasSecretStore()
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

	if libkb.HasSecretStore() {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret()
		if err != nil {
			t.Fatal(err)
		}
	}

	dbPath := tc.G.Env.GetDbFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)

	assertFileExists(t, dbPath)
	assertFileExists(t, secretKeysPath)
	if !isUserInConfigFile(tc, *fu) {
		t.Fatalf("User %s is not in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if !isUserConfigInMemory(tc) {
		t.Fatalf("user config is not in memory")
	}

	if !LoggedIn(tc) {
		t.Fatal("Unexpectedly logged out")
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
		t.Fatal(err)
	}

	if LoggedIn(tc) {
		t.Error("Unexpectedly still logged in")
	}

	if libkb.HasSecretStore() {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret()
		if err == nil {
			t.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(t, dbPath)
	assertFileDoesNotExist(t, secretKeysPath)
	if isUserInConfigFile(tc, *fu) {
		t.Fatalf("User %s is still in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if isUserConfigInMemory(tc) {
		t.Fatalf("user config is still in memory")
	}

	newNumKeys := getNumKeys(tc, *fu)
	if newNumKeys != numKeys {
		t.Fatalf("expected the same number of device keys, before: %d, after: %d", numKeys, newNumKeys)
	}
}

func TestCurrentDeviceRevoked(t *testing.T) {
	tc := SetupEngineTest(t, "deprovision")
	defer tc.Cleanup()

	// Sign up a new user and have it store its secret in the
	// secret store (if possible).
	fu := NewFakeUserOrBust(tc.T, "dpr")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = libkb.HasSecretStore()
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

	if libkb.HasSecretStore() {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		_, err := secretStore.RetrieveSecret()
		if err != nil {
			t.Fatal(err)
		}
	}

	dbPath := tc.G.Env.GetDbFilename()
	secretKeysPath := tc.G.SKBFilenameForUser(fu.NormalizedUsername())
	numKeys := getNumKeys(tc, *fu)

	assertFileExists(t, dbPath)
	assertFileExists(t, secretKeysPath)
	if !isUserInConfigFile(tc, *fu) {
		t.Fatalf("User %s is not in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if !isUserConfigInMemory(tc) {
		t.Fatalf("user config is not in memory")
	}

	if !LoggedIn(tc) {
		t.Fatal("Unexpectedly logged out")
	}

	// Revoke the current device! This will cause an error when deprovision
	// tries to revoke the device again, but deprovision should carry on.
	err = doRevokeDevice(tc, fu, tc.G.Env.GetDeviceID(), true /* force */)
	if err != nil {
		t.Fatal(err)
	}

	e := NewDeprovisionEngine(tc.G, fu.Username, true /* doRevoke */)
	ctx = &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	if err := RunEngine(e, ctx); err != nil {
		t.Fatal(err)
	}

	if LoggedIn(tc) {
		t.Error("Unexpectedly still logged in")
	}

	if libkb.HasSecretStore() {
		secretStore := libkb.NewSecretStore(tc.G, fu.NormalizedUsername())
		secret, err := secretStore.RetrieveSecret()
		if err == nil {
			t.Errorf("Unexpectedly got secret %v", secret)
		}
	}

	assertFileDoesNotExist(t, dbPath)
	assertFileDoesNotExist(t, secretKeysPath)
	if isUserInConfigFile(tc, *fu) {
		t.Fatalf("User %s is still in the config file %s", fu.Username, tc.G.Env.GetConfigFilename())
	}
	if isUserConfigInMemory(tc) {
		t.Fatalf("user config is still in memory")
	}

	newNumKeys := getNumKeys(tc, *fu)
	if newNumKeys != numKeys-2 {
		t.Fatalf("failed to revoke device keys, before: %d, after: %d", numKeys, newNumKeys)
	}
}
