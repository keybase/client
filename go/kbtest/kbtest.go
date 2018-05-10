// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbtest

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

const testInviteCode = "202020202020202020202020"

const DefaultDeviceName = "my device"

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
	uis := libkb.UIs{
		ProvisionUI: &TestProvisionUI{},
		LogUI:       g.UI.GetLogUI(),
		GPGUI:       &gpgtestui{},
		SecretUI:    fu.NewSecretUI(),
		LoginUI:     &libkb.TestLoginUI{Username: fu.Username},
	}
	li := engine.NewLogin(g, libkb.DeviceTypeDesktop, fu.Username, keybase1.ClientType_CLI)
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	return engine.RunEngine2(m, li)
}

func CreateAndSignupFakeUser(prefix string, g *libkb.GlobalContext) (*FakeUser, error) {
	return createAndSignupFakeUser(prefix, g, true)
}

func CreateAndSignupFakeUserPaper(prefix string, g *libkb.GlobalContext) (*FakeUser, error) {
	return createAndSignupFakeUser(prefix, g, false)
}

func createAndSignupFakeUser(prefix string, g *libkb.GlobalContext, skipPaper bool) (*FakeUser, error) {
	fu, err := NewFakeUser(prefix)
	if err != nil {
		return nil, err
	}
	arg := engine.SignupEngineRunArg{
		Username:   fu.Username,
		Email:      fu.Email,
		InviteCode: testInviteCode,
		Passphrase: fu.Passphrase,
		DeviceName: DefaultDeviceName,
		SkipGPG:    true,
		SkipMail:   true,
		SkipPaper:  skipPaper,
	}
	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := engine.NewSignupEngine(g, &arg)
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	if err := engine.RunEngine2(m, s); err != nil {
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
	err := tc.G.LoginState().ResetAccount(libkb.NewMetaContextForTest(tc), u.Username)
	if err != nil {
		tc.T.Fatalf("In account reset: %s", err)
	}
	tc.T.Logf("Account reset for user %s", u.Username)
	Logout(tc)
}

func DeleteAccount(tc libkb.TestContext, u *FakeUser) {
	err := tc.G.LoginState().DeleteAccount(libkb.NewMetaContextForTest(tc), u.Username)
	if err != nil {
		tc.T.Fatalf("In delete: %s", err)
	}
	tc.T.Logf("Account deleted for user %s", u.Username)
	Logout(tc)
}

// copied from engine/common_test.go
func Logout(tc libkb.TestContext) {
	if err := tc.G.Logout(); err != nil {
		tc.T.Fatalf("logout error: %s", err)
	}
}

func AssertProvisioned(tc libkb.TestContext) error {
	prov, err := tc.G.LoginState().LoggedInProvisioned(context.TODO())
	if err != nil {
		return err
	}
	if !prov {
		return libkb.LoginRequiredError{}
	}
	return nil
}

type TestProvisionUI struct {
	SecretCh chan kex2.Secret
}

func (u *TestProvisionUI) ChooseProvisioningMethod(_ context.Context, _ keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	panic("ChooseProvisioningMethod deprecated")
}

func (u *TestProvisionUI) ChooseGPGMethod(_ context.Context, _ keybase1.ChooseGPGMethodArg) (keybase1.GPGMethod, error) {
	return keybase1.GPGMethod_GPG_NONE, nil
}

func (u *TestProvisionUI) SwitchToGPGSignOK(ctx context.Context, arg keybase1.SwitchToGPGSignOKArg) (bool, error) {
	return true, nil
}

func (u *TestProvisionUI) ChooseDevice(_ context.Context, arg keybase1.ChooseDeviceArg) (keybase1.DeviceID, error) {
	return "", nil
}

func (u *TestProvisionUI) ChooseDeviceType(_ context.Context, _ keybase1.ChooseDeviceTypeArg) (keybase1.DeviceType, error) {
	return keybase1.DeviceType_DESKTOP, nil
}

func (u *TestProvisionUI) DisplayAndPromptSecret(_ context.Context, arg keybase1.DisplayAndPromptSecretArg) (keybase1.SecretResponse, error) {
	var ks kex2.Secret
	copy(ks[:], arg.Secret)
	u.SecretCh <- ks
	var sr keybase1.SecretResponse
	return sr, nil
}

func (u *TestProvisionUI) PromptNewDeviceName(_ context.Context, arg keybase1.PromptNewDeviceNameArg) (string, error) {
	return libkb.RandString("device", 5)
}

func (u *TestProvisionUI) DisplaySecretExchanged(_ context.Context, _ int) error {
	return nil
}

func (u *TestProvisionUI) ProvisioneeSuccess(_ context.Context, _ keybase1.ProvisioneeSuccessArg) error {
	return nil
}

func (u *TestProvisionUI) ProvisionerSuccess(_ context.Context, _ keybase1.ProvisionerSuccessArg) error {
	return nil
}

type TeamNotifyListener struct {
	libkb.NoopNotifyListener
	changeByIDCh   chan keybase1.TeamChangedByIDArg
	changeByNameCh chan keybase1.TeamChangedByNameArg
}

var _ libkb.NotifyListener = (*TeamNotifyListener)(nil)

func (n *TeamNotifyListener) TeamChangedByID(teamID keybase1.TeamID, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet) {
	n.changeByIDCh <- keybase1.TeamChangedByIDArg{
		TeamID:       teamID,
		LatestSeqno:  latestSeqno,
		ImplicitTeam: implicitTeam,
		Changes:      changes,
	}
}
func (n *TeamNotifyListener) TeamChangedByName(teamName string, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet) {
	n.changeByNameCh <- keybase1.TeamChangedByNameArg{
		TeamName:     teamName,
		LatestSeqno:  latestSeqno,
		ImplicitTeam: implicitTeam,
		Changes:      changes,
	}
}

func NewTeamNotifyListener() *TeamNotifyListener {
	return &TeamNotifyListener{
		changeByIDCh:   make(chan keybase1.TeamChangedByIDArg, 10),
		changeByNameCh: make(chan keybase1.TeamChangedByNameArg, 10),
	}
}

func CheckTeamMiscNotifications(tc libkb.TestContext, notifications *TeamNotifyListener) {
	changeByID := false
	changeByName := false
	for {
		select {
		case arg := <-notifications.changeByIDCh:
			changeByID = arg.Changes.Misc
		case arg := <-notifications.changeByNameCh:
			changeByName = arg.Changes.Misc
		case <-time.After(500 * time.Millisecond * libkb.CITimeMultiplier(tc.G)):
			tc.T.Fatal("no notification on teamSetSettings")
		}
		if changeByID && changeByName {
			return
		}
	}
}
