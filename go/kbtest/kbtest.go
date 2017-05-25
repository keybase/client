// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbtest

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const testInviteCode = "202020202020202020202020"

type FakeUser struct {
	Username   string
	Email      string
	Passphrase string
	User       *libkb.User
}

func NewFakeUser(prefix string) (*FakeUser, error) {
	buf := make([]byte, 5)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	username := fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email := fmt.Sprintf("%s@noemail.keybase.io", username)
	buf = make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	passphrase := hex.EncodeToString(buf)
	return &FakeUser{username, email, passphrase, nil}, nil
}

func (fu *FakeUser) NewSecretUI() *libkb.TestSecretUI {
	return &libkb.TestSecretUI{Passphrase: fu.Passphrase}
}

func (fu *FakeUser) Login(g *libkb.GlobalContext) error {
	ctx := &engine.Context{
		ProvisionUI: newTestProvisionUI(),
		LogUI:       g.UI.GetLogUI(),
		GPGUI:       &gpgtestui{},
		SecretUI:    fu.NewSecretUI(),
		LoginUI:     &libkb.TestLoginUI{Username: fu.Username},
	}
	li := engine.NewLogin(g, libkb.DeviceTypeDesktop, fu.Username, keybase1.ClientType_CLI)
	return engine.RunEngine(li, ctx)
}

func CreateAndSignupFakeUser(prefix string, g *libkb.GlobalContext) (*FakeUser, error) {
	fu, err := NewFakeUser(prefix)
	if err != nil {
		return nil, err
	}
	arg := engine.SignupEngineRunArg{
		Username:   fu.Username,
		Email:      fu.Email,
		InviteCode: testInviteCode,
		Passphrase: fu.Passphrase,
		DeviceName: "my device",
		SkipGPG:    true,
		SkipMail:   true,
	}
	ctx := &engine.Context{
		LogUI:    g.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := engine.NewSignupEngine(&arg, g)
	if err := engine.RunEngine(s, ctx); err != nil {
		return nil, err
	}
	fu.User, err = libkb.LoadUser(libkb.NewLoadUserByNameArg(g, fu.Username))
	if err != nil {
		return nil, err
	}
	return fu, nil
}

// copied from engine/common_test.go
func ResetAccount(tc libkb.TestContext, u *FakeUser) {
	err := tc.G.LoginState().ResetAccount(u.Username)
	if err != nil {
		tc.T.Fatalf("In account reset: %s", err)
	}
	tc.T.Logf("Account reset for user %s", u.Username)
	Logout(tc)
}

// copied from engine/common_test.go
func Logout(tc libkb.TestContext) {
	if err := tc.G.Logout(); err != nil {
		tc.T.Fatalf("logout error: %s", err)
	}
}

func AssertProvisioned(tc libkb.TestContext) error {
	prov, err := tc.G.LoginState().LoggedInProvisionedCheck()
	if err != nil {
		return err
	}
	if !prov {
		return libkb.LoginRequiredError{}
	}
	return nil
}

type testProvisionUI struct {
	secretCh               chan kex2.Secret
	method                 keybase1.ProvisionMethod
	gpgMethod              keybase1.GPGMethod
	chooseDevice           string
	verbose                bool
	calledChooseDeviceType int
	abortSwitchToGPGSign   bool
}

func newTestProvisionUI() *testProvisionUI {
	ui := &testProvisionUI{method: keybase1.ProvisionMethod_DEVICE}
	if len(os.Getenv("KB_TEST_VERBOSE")) > 0 {
		ui.verbose = true
	}
	ui.gpgMethod = keybase1.GPGMethod_GPG_IMPORT
	return ui
}

func (u *testProvisionUI) printf(format string, a ...interface{}) {
	if !u.verbose {
		return
	}
	fmt.Printf("testProvisionUI: "+format+"\n", a...)
}

func (u *testProvisionUI) ChooseProvisioningMethod(_ context.Context, _ keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	panic("ChooseProvisioningMethod deprecated")
}

func (u *testProvisionUI) ChooseGPGMethod(_ context.Context, _ keybase1.ChooseGPGMethodArg) (keybase1.GPGMethod, error) {
	u.printf("ChooseGPGMethod")
	return u.gpgMethod, nil
}

func (u *testProvisionUI) SwitchToGPGSignOK(ctx context.Context, arg keybase1.SwitchToGPGSignOKArg) (bool, error) {
	if u.abortSwitchToGPGSign {
		return false, nil
	}
	return true, nil
}

func (u *testProvisionUI) ChooseDevice(_ context.Context, arg keybase1.ChooseDeviceArg) (keybase1.DeviceID, error) {
	u.printf("ChooseDevice")
	if len(arg.Devices) == 0 {
		return "", nil
	}

	if u.chooseDevice == "none" {
		return "", nil
	}

	if len(u.chooseDevice) > 0 {
		for _, d := range arg.Devices {
			if d.Type == u.chooseDevice {
				return d.DeviceID, nil
			}
		}
	}
	return "", nil
}

func (u *testProvisionUI) ChooseDeviceType(_ context.Context, _ keybase1.ChooseDeviceTypeArg) (keybase1.DeviceType, error) {
	u.printf("ChooseDeviceType")
	u.calledChooseDeviceType++
	return keybase1.DeviceType_DESKTOP, nil
}

func (u *testProvisionUI) DisplayAndPromptSecret(_ context.Context, arg keybase1.DisplayAndPromptSecretArg) (keybase1.SecretResponse, error) {
	u.printf("DisplayAndPromptSecret")
	var ks kex2.Secret
	copy(ks[:], arg.Secret)
	u.secretCh <- ks
	var sr keybase1.SecretResponse
	return sr, nil
}

func (u *testProvisionUI) PromptNewDeviceName(_ context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	u.printf("PromptNewDeviceName")
	return libkb.RandString("device", 5)
}

func (u *testProvisionUI) DisplaySecretExchanged(_ context.Context, _ int) error {
	u.printf("DisplaySecretExchanged")
	return nil
}

func (u *testProvisionUI) ProvisioneeSuccess(_ context.Context, _ keybase1.ProvisioneeSuccessArg) error {
	u.printf("ProvisioneeSuccess")
	return nil
}

func (u *testProvisionUI) ProvisionerSuccess(_ context.Context, _ keybase1.ProvisionerSuccessArg) error {
	u.printf("ProvisionerSuccess")
	return nil
}
