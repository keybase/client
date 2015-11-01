// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"crypto/rand"
	"fmt"
	"sync"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func TestDeviceAdd(t *testing.T) {
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "template")
	defer tcY.Cleanup()

	// provisioner needs to be logged in
	userX := CreateAndSignupFakeUser(tcX, "login")
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
		ctx := &Context{
			ProvisionUI: &testProvisionUI{secretCh: make(chan kex2.Secret, 1)},
		}
		deviceID, err := libkb.NewDeviceID()
		if err != nil {
			t.Errorf("provisionee device id error: %s", err)
			return
		}
		suffix, err := libkb.RandBytes(5)
		if err != nil {
			t.Errorf("provisionee device suffix error: %s", err)
			return
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
			return
		}
	}()

	// run DeviceAdd engine on device X
	ctx := &Context{
		SecretUI:    userX.NewSecretUI(),
		ProvisionUI: &testXProvisionUI{secret: secretY},
	}
	eng := NewDeviceAdd(tcX.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Errorf("device add error: %s", err)
	}

	wg.Wait()
}

type testXProvisionUI struct {
	secret kex2.Secret
	testProvisionUI
}

func (u *testXProvisionUI) DisplayAndPromptSecret(_ context.Context, arg keybase1.DisplayAndPromptSecretArg) ([]byte, error) {
	return u.secret[:], nil
}
