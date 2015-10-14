package engine

import (
	"crypto/rand"
	"sync"
	"testing"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
)

func TestKex2Provision(t *testing.T) {
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "kex2provision")
	defer tcX.Cleanup()

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "kex2provision")
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
		ctx := &Context{}
		deviceID, err := libkb.NewDeviceID()
		if err != nil {
			t.Errorf("provisionee device id error: %s", err)
			return
		}
		provisionee := NewKex2Provisionee(tcY.G, deviceID, secretY)
		if err := RunEngine(provisionee, ctx); err != nil {
			t.Errorf("provisionee error: %s", err)
		}
	}()

	// start provisioner
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx := &Context{
			SecretUI: userX.NewSecretUI(),
		}
		deviceID, err := libkb.NewDeviceID()
		if err != nil {
			t.Errorf("provisioner device id error: %s", err)
			return
		}
		provisioner := NewKex2Provisioner(tcX.G, deviceID, secretX)
		go provisioner.AddSecret(secretY)
		if err := RunEngine(provisioner, ctx); err != nil {
			t.Errorf("provisioner error: %s", err)
		}
	}()

	wg.Wait()
}
