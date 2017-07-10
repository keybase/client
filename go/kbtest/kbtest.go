// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbtest

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const testInviteCode = "202020202020202020202020"

type FakeUser struct {
	Username    string
	Email       string
	Passphrase  string
	User        *libkb.User
	EldestSeqno keybase1.Seqno
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
	return &FakeUser{username, email, passphrase, nil, keybase1.Seqno(1)}, nil
}

func (fu *FakeUser) NewSecretUI() *libkb.TestSecretUI {
	return &libkb.TestSecretUI{Passphrase: fu.Passphrase}
}

func (fu *FakeUser) GetUID() keybase1.UID {
	return libkb.UsernameToUID(fu.Username)
}

func (fu *FakeUser) GetUserVersion() keybase1.UserVersion {
	return keybase1.UserVersion{
		Uid:         fu.GetUID(),
		EldestSeqno: fu.EldestSeqno,
	}
}

func (fu *FakeUser) Login(g *libkb.GlobalContext) error {
	ctx := &engine.Context{
		ProvisionUI: &testProvisionUI{},
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
}

func (u *testProvisionUI) ChooseProvisioningMethod(_ context.Context, _ keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	panic("ChooseProvisioningMethod deprecated")
}

func (u *testProvisionUI) ChooseGPGMethod(_ context.Context, _ keybase1.ChooseGPGMethodArg) (keybase1.GPGMethod, error) {
	return keybase1.GPGMethod_GPG_NONE, nil
}

func (u *testProvisionUI) SwitchToGPGSignOK(ctx context.Context, arg keybase1.SwitchToGPGSignOKArg) (bool, error) {
	return true, nil
}

func (u *testProvisionUI) ChooseDevice(_ context.Context, arg keybase1.ChooseDeviceArg) (keybase1.DeviceID, error) {
	return "", nil
}

func (u *testProvisionUI) ChooseDeviceType(_ context.Context, _ keybase1.ChooseDeviceTypeArg) (keybase1.DeviceType, error) {
	return keybase1.DeviceType_DESKTOP, nil
}

func (u *testProvisionUI) DisplayAndPromptSecret(_ context.Context, arg keybase1.DisplayAndPromptSecretArg) (keybase1.SecretResponse, error) {
	var sr keybase1.SecretResponse
	return sr, nil
}

func (u *testProvisionUI) PromptNewDeviceName(_ context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	return libkb.RandString("device", 5)
}

func (u *testProvisionUI) DisplaySecretExchanged(_ context.Context, _ int) error {
	return nil
}

func (u *testProvisionUI) ProvisioneeSuccess(_ context.Context, _ keybase1.ProvisioneeSuccessArg) error {
	return nil
}

func (u *testProvisionUI) ProvisionerSuccess(_ context.Context, _ keybase1.ProvisionerSuccessArg) error {
	return nil
}
