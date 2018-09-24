// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
	"github.com/stretchr/testify/require"
)

func TestDeviceAdd(t *testing.T) {
	testDeviceAdd(t, false)
}

func TestDeviceAddPUK(t *testing.T) {
	testDeviceAdd(t, true)
}

func runDeviceAddTest(t *testing.T, wg *sync.WaitGroup, tcY *libkb.TestContext, secretY kex2.Secret,
	uid keybase1.UID) {
	defer wg.Done()
	err := (func() error {
		uis := libkb.UIs{
			ProvisionUI: &testProvisionUI{secretCh: make(chan kex2.Secret, 1)},
		}
		m := NewMetaContextForTest(*tcY).WithUIs(uis).WithNewProvisionalLoginContext()
		deviceID, err := libkb.NewDeviceID()
		if err != nil {
			return err
		}
		suffix, err := libkb.RandBytes(5)
		if err != nil {
			return err
		}
		dname := fmt.Sprintf("device_%x", suffix)
		device := &libkb.Device{
			ID:          deviceID,
			Description: &dname,
			Type:        libkb.DeviceTypeDesktop,
		}
		provisionee := NewKex2Provisionee(tcY.G, device, secretY, uid, fakeSalt())
		return RunEngine2(m, provisionee)
	})()
	require.NoError(t, err, "kex2 provisionee")
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
	go runDeviceAddTest(t, &wg, &tcY, secretY, userX.UID())

	// run DeviceAdd engine on device X
	uis := libkb.UIs{
		SecretUI:    userX.NewSecretUI(),
		ProvisionUI: &testXProvisionUI{secret: secretY},
	}
	eng := NewDeviceAdd(tcX.G)
	m := NewMetaContextForTest(tcX).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Errorf("device add error: %s", err)
	}

	wg.Wait()
}

func TestDeviceAddPhraseLegacyDesktop(t *testing.T) {
	testDeviceAddPhrase(t, libkb.Kex2SecretTypeV1Desktop)
}

func TestDeviceAddPhraseLegacyMobile(t *testing.T) {
	testDeviceAddPhrase(t, libkb.Kex2SecretTypeV1Mobile)
}

func TestDeviceAddPhraseV2(t *testing.T) {
	testDeviceAddPhrase(t, libkb.Kex2SecretTypeV2)
}

func testDeviceAddPhrase(t *testing.T, typ libkb.Kex2SecretType) {

	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "template")
	defer tcY.Cleanup()

	// provisioner needs to be logged in
	userX := CreateAndSignupFakeUser(tcX, "login")

	secretY, err := libkb.NewKex2SecretFromTypeAndUID(typ, userX.UID())
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go runDeviceAddTest(t, &wg, &tcY, secretY.Secret(), userX.UID())

	// run DeviceAdd engine on device X
	uis := libkb.UIs{
		SecretUI:    userX.NewSecretUI(),
		ProvisionUI: &testPhraseProvisionUI{phrase: secretY.Phrase()},
	}
	eng := NewDeviceAdd(tcX.G)
	m := NewMetaContextForTest(tcX).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
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
	go runDeviceAddTest(t, &wg, &tcY, secretY, userX.UID())

	testSecretUI := userX.NewSecretUI()

	// run DeviceAdd engine on device X
	uis := libkb.UIs{
		SecretUI:    testSecretUI,
		ProvisionUI: &testXProvisionUI{secret: secretY},
	}
	eng := NewDeviceAdd(tcX.G)
	m := NewMetaContextForTest(tcX).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
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
