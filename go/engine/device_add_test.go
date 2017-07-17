// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"crypto/rand"
	"fmt"
	"sync"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestDeviceAdd(t *testing.T) {
	testDeviceAdd(t, false)
}

func TestDeviceAddPUK(t *testing.T) {
	testDeviceAdd(t, true)
}

func runDeviceAddTest(t *testing.T, wg *sync.WaitGroup, tcY *libkb.TestContext, secretY kex2.Secret) {
	defer wg.Done()
	f := func(lctx libkb.LoginContext) error {
		ctx := &Context{
			ProvisionUI:  &testProvisionUI{secretCh: make(chan kex2.Secret, 1)},
			LoginContext: lctx,
			NetContext:   context.TODO(),
		}
		deviceID, err := libkb.NewDeviceID()
		if err != nil {
			t.Errorf("provisionee device id error: %s", err)
			return err
		}
		suffix, err := libkb.RandBytes(5)
		if err != nil {
			t.Errorf("provisionee device suffix error: %s", err)
			return err
		}
		dname := fmt.Sprintf("device_%x", suffix)
		device := &libkb.Device{
			ID:          deviceID,
			Description: &dname,
			Type:        libkb.DeviceTypeDesktop,
		}
		provisionee := NewKex2Provisionee(tcY.G, device, secretY)
		if err := RunEngine(provisionee, ctx); err != nil {
			t.Errorf("provisionee error: %s", err)
			return err
		}
		return nil
	}

	if err := tcY.G.LoginState().ExternalFunc(f, "Test - DeviceAdd"); err != nil {
		t.Errorf("kex2 provisionee error: %s", err)
	}
}

func testDeviceAdd(t *testing.T, upgradePerUserKey bool) {
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()
	tcX.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "template")
	defer tcY.Cleanup()
	tcY.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	// provisioner needs to be logged in
	userX := CreateAndSignupFakeUser(tcX, "login")

	var secretY kex2.Secret
	if _, err := rand.Read(secretY[:]); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go runDeviceAddTest(t, &wg, &tcY, secretY)

	// run DeviceAdd engine on device X
	ctx := &Context{
		SecretUI:    userX.NewSecretUI(),
		ProvisionUI: &testXProvisionUI{secret: secretY},
		NetContext:  context.TODO(),
	}
	eng := NewDeviceAdd(tcX.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Errorf("device add error: %s", err)
	}

	wg.Wait()
}

func TestDeviceAddPhrase(t *testing.T) {
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "template")
	defer tcY.Cleanup()

	// provisioner needs to be logged in
	userX := CreateAndSignupFakeUser(tcX, "login")

	secretY, err := libkb.NewKex2Secret(false)
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go runDeviceAddTest(t, &wg, &tcY, secretY.Secret())

	// run DeviceAdd engine on device X
	ctx := &Context{
		SecretUI:    userX.NewSecretUI(),
		ProvisionUI: &testPhraseProvisionUI{phrase: secretY.Phrase()},
		NetContext:  context.TODO(),
	}
	eng := NewDeviceAdd(tcX.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Errorf("device add error: %s", err)
	}

	wg.Wait()
}

func TestDeviceAddStoredSecret(t *testing.T) {
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "template")
	defer tcY.Cleanup()

	// provisioner needs to be logged in
	userX := SignupFakeUserStoreSecret(tcX, "login")

	var secretY kex2.Secret
	if _, err := rand.Read(secretY[:]); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go runDeviceAddTest(t, &wg, &tcY, secretY)

	testSecretUI := userX.NewSecretUI()

	// run DeviceAdd engine on device X
	ctx := &Context{
		SecretUI:    testSecretUI,
		ProvisionUI: &testXProvisionUI{secret: secretY},
		NetContext:  context.TODO(),
	}
	eng := NewDeviceAdd(tcX.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Errorf("device add error: %s", err)
	}

	wg.Wait()

	if testSecretUI.CalledGetPassphrase {
		t.Fatal("GetPassphrase() unexpectedly called")
	}
}

type testXProvisionUI struct {
	secret kex2.Secret
	testProvisionUI
}

func (u *testXProvisionUI) DisplayAndPromptSecret(_ context.Context, arg keybase1.DisplayAndPromptSecretArg) (keybase1.SecretResponse, error) {
	return keybase1.SecretResponse{Secret: u.secret[:]}, nil
}

type testPhraseProvisionUI struct {
	phrase string
	testProvisionUI
}

func (u *testPhraseProvisionUI) DisplayAndPromptSecret(_ context.Context, arg keybase1.DisplayAndPromptSecretArg) (keybase1.SecretResponse, error) {
	return keybase1.SecretResponse{Phrase: u.phrase}, nil
}
