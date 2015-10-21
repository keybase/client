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
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()

	// provisioner needs to be logged in
	userX := CreateAndSignupFakeUser(tcX, "login")

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "kex2provision")
	defer tcY.Cleanup()

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

	// start provisioner
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx := &Context{
			SecretUI:    userX.NewSecretUI(),
			ProvisionUI: &testProvisionUI{},
		}
		provisioner := NewKex2Provisioner(tcX.G, secretX)
		go provisioner.AddSecret(secretY)
		if err := RunEngine(provisioner, ctx); err != nil {
			t.Errorf("provisioner error: %s", err)
			return
		}
	}()

	wg.Wait()
}
