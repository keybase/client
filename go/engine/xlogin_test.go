package engine

import (
	"crypto/rand"
	"fmt"
	"os"
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
		ProvisionUI: newTestProvisionUISecretCh(secretCh),
		LoginUI:     &libkb.TestLoginUI{},
		LogUI:       tcY.G.UI.GetLogUI(),
		SecretUI:    &libkb.TestSecretUI{},
	}
	eng := NewXLogin(tcY.G, libkb.DeviceTypeDesktop, "")

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go func() {
		defer wg.Done()
		tcY.G.Log.Warning("starting xlogin")
		if err := RunEngine(eng, ctx); err != nil {
			t.Errorf("xlogin error: %s", err)
			return
		}
	}()

	// start provisioner
	provisioner := NewKex2Provisioner(tcX.G, secretX)
	wg.Add(1)
	go func() {
		defer wg.Done()

		ctx := &Context{
			SecretUI:    userX.NewSecretUI(),
			ProvisionUI: newTestProvisionUI(),
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

// If a user has device keys, selecting the username/passphrase
// provisioning option should fail.
func TestProvisionPassphraseFail(t *testing.T) {
	// device X (provisioner) context:
	tcX := SetupEngineTest(t, "provision_x")
	defer tcX.Cleanup()

	// create user (and device X)
	userX := CreateAndSignupFakeUser(tcX, "login")

	// device Y (provisionee) context:
	tcY := SetupEngineTest(t, "provision_y")
	defer tcY.Cleanup()

	ctx := &Context{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{Username: userX.Username},
		LogUI:       tcY.G.UI.GetLogUI(),
		SecretUI:    &libkb.TestSecretUI{},
	}
	eng := NewXLogin(tcY.G, libkb.DeviceTypeDesktop, "")
	err := RunEngine(eng, ctx)
	if err == nil {
		t.Fatal("expected xlogin to fail, but it ran without error")
	}
	if _, ok := err.(libkb.PassphraseProvisionImpossibleError); !ok {
		t.Fatalf("expected PassphraseProvisionImpossibleError, got %T (%s)", err, err)
	}
}

// If a user has no keys, provision via passphrase should work.
func TestProvisionPassphraseNoKeys(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(tc)

	Logout(tc)

	ctx := &Context{
		ProvisionUI: newTestProvisionUIPassphrase(),
		LoginUI:     &libkb.TestLoginUI{Username: username},
		LogUI:       tc.G.UI.GetLogUI(),
		SecretUI:    &libkb.TestSecretUI{Passphrase: passphrase},
	}
	eng := NewXLogin(tc.G, libkb.DeviceTypeDesktop, "")
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(tc)

	// and they should have a paper backup key
	hasOnePaperDev(tc, &FakeUser{Username: username, Passphrase: passphrase})
}

type testProvisionUI struct {
	secretCh chan kex2.Secret
	method   keybase1.ProvisionMethod
	verbose  bool
}

func newTestProvisionUI() *testProvisionUI {
	ui := &testProvisionUI{method: keybase1.ProvisionMethod_DEVICE}
	if len(os.Getenv("KB_TEST_VERBOSE")) > 0 {
		ui.verbose = true
	}
	return ui
}

func newTestProvisionUISecretCh(ch chan kex2.Secret) *testProvisionUI {
	ui := newTestProvisionUI()
	ui.secretCh = ch
	return ui
}

func newTestProvisionUIPassphrase() *testProvisionUI {
	ui := newTestProvisionUI()
	ui.method = keybase1.ProvisionMethod_PASSPHRASE
	return ui
}

func (u *testProvisionUI) printf(format string, a ...interface{}) {
	if !u.verbose {
		return
	}
	fmt.Printf("testProvisionUI: "+format+"\n", a...)
}

func (u *testProvisionUI) ChooseProvisioningMethod(_ context.Context, _ keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	// u.printf("ChooseProvisioningMethod")
	return u.method, nil
}

func (u *testProvisionUI) ChooseDeviceType(_ context.Context, _ int) (keybase1.DeviceType, error) {
	// u.printf("ChooseProvisionerDevice")
	return keybase1.DeviceType_DESKTOP, nil
}

func (u *testProvisionUI) DisplayAndPromptSecret(_ context.Context, arg keybase1.DisplayAndPromptSecretArg) ([]byte, error) {
	// u.printf("DisplayAndPromptSecret")
	var ks kex2.Secret
	copy(ks[:], arg.Secret)
	u.secretCh <- ks
	return nil, nil
}

func (u *testProvisionUI) PromptNewDeviceName(_ context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	// u.printf("PromptNewDeviceName")
	return "device_xxx", nil
}

func (u *testProvisionUI) DisplaySecretExchanged(_ context.Context, _ int) error {
	// u.printf("DisplaySecretExchanged")
	return nil
}

func (u *testProvisionUI) ProvisionSuccess(_ context.Context, _ int) error {
	// u.printf("ProvisionSuccess")
	return nil
}
