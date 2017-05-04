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
)

func TestKex2Provision(t *testing.T) {
	subTestKex2Provision(t, false)
}

func TestKex2ProvisionSDH(t *testing.T) {
	t.Skip("TODO waiting for PerUserSecretRewrite")
	subTestKex2Provision(t, true)
}

func subTestKex2Provision(t *testing.T, enableSharedDH bool) {
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()
	tcX.Tp.EnableSharedDH = enableSharedDH

	// provisioner needs to be logged in
	userX := CreateAndSignupFakeUser(tcX, "login")

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "kex2provision")
	defer tcY.Cleanup()
	tcY.Tp.EnableSharedDH = enableSharedDH

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

		f := func(lctx libkb.LoginContext) error {

			ctx := &Context{
				ProvisionUI:  &testProvisionUI{secretCh: make(chan kex2.Secret, 1)},
				LoginContext: lctx,
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

		if err := tcY.G.LoginState().ExternalFunc(f, "Test - Kex2Provision"); err != nil {
			t.Errorf("kex2 provisionee error: %s", err)
		}
	}()

	// start provisioner
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx := &Context{
			SecretUI:    userX.NewSecretUI(),
			ProvisionUI: &testProvisionUI{},
		}
		provisioner := NewKex2Provisioner(tcX.G, secretX, nil)
		go provisioner.AddSecret(secretY)
		if err := RunEngine(provisioner, ctx); err != nil {
			t.Errorf("provisioner error: %s", err)
			return
		}
	}()

	wg.Wait()
}
