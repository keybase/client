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

func TestXLogin(t *testing.T) {
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

	secretCh := make(chan kex2.Secret)

	// provisionee calls xlogin:
	ctx := &Context{
		ProvisionUI: &testProvisionUI{secretCh: secretCh},
	}
	eng := NewXLogin(tcY.G, libkb.DeviceTypeDesktop, "")

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := RunEngine(eng, ctx); err != nil {
			t.Fatal(err)
		}
	}()

	// start provisioner
	provisioner := NewKex2Provisioner(tcX.G, secretX)
	wg.Add(1)
	go func() {
		defer wg.Done()

		ctx := &Context{
			SecretUI:    userX.NewSecretUI(),
			ProvisionUI: &testProvisionUI{},
		}
		if err := RunEngine(provisioner, ctx); err != nil {
			t.Errorf("provisioner error: %s", err)
			return
		}
	}()
	secretFromY := <-secretCh
	provisioner.AddSecret(secretFromY)

	wg.Wait()
}

type testProvisionUI struct {
	secretCh chan kex2.Secret
}

func (u *testProvisionUI) ChooseProvisioningMethod(_ context.Context, _ keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	fmt.Printf("ChooseProvisioningMethod\n")
	return keybase1.ProvisionMethod_DEVICE, nil
}

func (u *testProvisionUI) ChooseDeviceType(_ context.Context, _ int) (keybase1.DeviceType, error) {
	fmt.Printf("ChooseProvisionerDevice\n")
	return keybase1.DeviceType_DESKTOP, nil
}

func (u *testProvisionUI) DisplayAndPromptSecret(_ context.Context, arg keybase1.DisplayAndPromptSecretArg) ([]byte, error) {
	fmt.Printf("DisplayAndPromptSecret\n")
	var ks kex2.Secret
	copy(ks[:], arg.Secret)
	u.secretCh <- ks
	return nil, nil
}

func (u *testProvisionUI) PromptNewDeviceName(_ context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	fmt.Printf("PromptNewDeviceName\n")
	return "device_xxx", nil
}

func (u *testProvisionUI) DisplaySecretExchanged(_ context.Context, _ int) error {
	fmt.Printf("DisplaySecretExchanged\n")
	return nil
}

func (u *testProvisionUI) ProvisionSuccess(_ context.Context, _ int) error {
	fmt.Printf("ProvisionSuccess\n")
	return nil
}
