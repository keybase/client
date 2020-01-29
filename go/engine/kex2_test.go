// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"crypto/rand"
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestKex2Provision(t *testing.T) {
	subTestKex2Provision(t, false)
}

func TestKex2ProvisionPUK(t *testing.T) {
	subTestKex2Provision(t, true)
}

func subTestKex2Provision(t *testing.T, upgradePerUserKey bool) {
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()

	tcX.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	// provisioner needs to be logged in
	userX := CreateAndSignupFakeUser(tcX, "login")

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "kex2provision")
	defer tcY.Cleanup()

	tcY.Tp.DisableUpgradePerUserKey = !upgradePerUserKey

	var secretX kex2.Secret
	if _, err := rand.Read(secretX[:]); err != nil {
		t.Fatal(err)
	}

	var secretY kex2.Secret
	if _, err := rand.Read(secretY[:]); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go func() {
		defer wg.Done()
		err := (func() error {
			uis := libkb.UIs{
				ProvisionUI: &testProvisionUI{secretCh: make(chan kex2.Secret, 1)},
			}
			m := NewMetaContextForTest(tcY).WithUIs(uis).WithNewProvisionalLoginContext()
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
			provisionee := NewKex2Provisionee(tcY.G, device, secretY, userX.UID(), fakeSalt())
			return RunEngine2(m, provisionee)
		})()
		require.NoError(t, err, "no kex2 provisionee error")
	}()

	// start provisioner
	wg.Add(1)
	go func() {
		defer wg.Done()
		uis := libkb.UIs{
			SecretUI:    userX.NewSecretUI(),
			ProvisionUI: &testProvisionUI{},
		}
		provisioner := NewKex2Provisioner(tcX.G, secretX, nil)
		m := NewMetaContextForTest(tcX).WithUIs(uis)
		go provisioner.AddSecret(secretY)
		if err := RunEngine2(m, provisioner); err != nil {
			t.Errorf("provisioner error: %s", err)
			return
		}
	}()

	wg.Wait()
}

// Get a new device, test context and all, by provisioning it from an existing test context.
// This was copied from subTestKex2Provision
// Note that it uses Errorf in goroutines, so if it fails
// the test will not fail until later.
// Returns (tcY, CleanupFunction)
func provisionNewDeviceKex(tcX *libkb.TestContext, userX *FakeUser) (*libkb.TestContext, func()) {
	// tcX is the device X (provisioner) context:
	// tcX should already have been logged in.

	t := tcX.T

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "kex2provision")
	cleanup := func() { tcY.Cleanup() }

	var secretX kex2.Secret
	if _, err := rand.Read(secretX[:]); err != nil {
		t.Fatal(err)
	}

	var secretY kex2.Secret
	if _, err := rand.Read(secretY[:]); err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go func() {
		defer wg.Done()
		err := (func() error {
			uis := libkb.UIs{
				ProvisionUI: &testProvisionUI{secretCh: make(chan kex2.Secret, 1)},
			}
			m := NewMetaContextForTest(tcY).WithUIs(uis).WithNewProvisionalLoginContext()
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
			provisionee := NewKex2Provisionee(tcY.G, device, secretY, userX.UID(), fakeSalt())
			return RunEngine2(m, provisionee)
		})()
		require.NoError(t, err, "kex2 provisionee")
	}()

	// start provisioner
	wg.Add(1)
	go func() {
		defer wg.Done()
		uis := libkb.UIs{
			SecretUI:    userX.NewSecretUI(),
			ProvisionUI: &testProvisionUI{},
		}
		provisioner := NewKex2Provisioner(tcX.G, secretX, nil)
		go provisioner.AddSecret(secretY)
		m := NewMetaContextForTest(*tcX).WithUIs(uis)
		if err := RunEngine2(m, provisioner); err != nil {
			t.Errorf("provisioner error: %s", err)
			return
		}
	}()

	wg.Wait()

	return &tcY, cleanup
}
