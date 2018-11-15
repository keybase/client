// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbtest

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/stretchr/testify/require"

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

func (fu FakeUser) NormalizedUsername() libkb.NormalizedUsername {
	return libkb.NewNormalizedUsername(fu.Username)
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
	return createAndSignupFakeUser(prefix, g, true, keybase1.DeviceType_DESKTOP)
}

func CreateAndSignupFakeUserPaper(prefix string, g *libkb.GlobalContext) (*FakeUser, error) {
	return createAndSignupFakeUser(prefix, g, false, keybase1.DeviceType_DESKTOP)
}

func CreateAndSignupFakeUserMobile(prefix string, g *libkb.GlobalContext) (*FakeUser, error) {
	return createAndSignupFakeUser(prefix, g, true, keybase1.DeviceType_MOBILE)
}

func createAndSignupFakeUser(prefix string, g *libkb.GlobalContext, skipPaper bool, deviceType keybase1.DeviceType) (*FakeUser, error) {
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
		DeviceType: deviceType,
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
	m := libkb.NewMetaContextForTest(tc)
	err := libkb.ResetAccount(m, u.NormalizedUsername(), u.Passphrase)
	require.NoError(tc.T, err)
	tc.T.Logf("Account reset for user %s", u.Username)
	Logout(tc)
}

func DeleteAccount(tc libkb.TestContext, u *FakeUser) {
	m := libkb.NewMetaContextForTest(tc)
	err := libkb.DeleteAccount(m, u.NormalizedUsername(), u.Passphrase)
	require.NoError(tc.T, err)
	tc.T.Logf("Account deleted for user %s", u.Username)
	Logout(tc)
}

// copied from engine/common_test.go
func Logout(tc libkb.TestContext) {
	if err := tc.G.Logout(context.TODO()); err != nil {
		tc.T.Fatalf("logout error: %s", err)
	}
}

func AssertProvisioned(tc libkb.TestContext) error {
	if !tc.G.ActiveDevice.Valid() {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func FakeSalt() []byte {
	return []byte("fakeSALTfakeSALT")
}

// Provision a new device (in context tcY) from the active (and logged in) device in test context tcX.
// This was adapted from engine/kex2_test.go
// Note that it uses Errorf in goroutines, so if it fails
// the test will not fail until later.
// tcX is a TestContext where device X (the provisioner) is already provisioned and logged in.
// this function will provision a new device Y inside tcY
func ProvisionNewDeviceKex(tcX *libkb.TestContext, tcY *libkb.TestContext, userX *FakeUser) {
	// tcX is the device X (provisioner) context:
	// tcX should already have been logged in.
	t := tcX.T

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
				ProvisionUI: &TestProvisionUI{SecretCh: make(chan kex2.Secret, 1)},
			}
			m := libkb.NewMetaContextForTest(*tcY).WithUIs(uis).WithNewProvisionalLoginContext()
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
			provisionee := engine.NewKex2Provisionee(tcY.G, device, secretY, userX.GetUID(), FakeSalt())
			return engine.RunEngine2(m, provisionee)
		})()
		require.NoError(t, err, "kex2 provisionee")
	}()

	// start provisioner
	wg.Add(1)
	go func() {
		defer wg.Done()
		uis := libkb.UIs{
			SecretUI:    userX.NewSecretUI(),
			ProvisionUI: &TestProvisionUI{},
		}
		provisioner := engine.NewKex2Provisioner(tcX.G, secretX, nil)
		go provisioner.AddSecret(secretY)
		m := libkb.NewMetaContextForTest(*tcX).WithUIs(uis)
		if err := engine.RunEngine2(m, provisioner); err != nil {
			require.NoErrorf(t, err, "provisioner error")
			return
		}
	}()

	wg.Wait()

	return
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

type fakeIdentifyUI struct {
	*engine.LoopbackIdentifyUI
}

func (l *fakeIdentifyUI) Confirm(o *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{IdentityConfirmed: true, RemoteConfirmed: true}, nil
}

func newFakeIdentifyUI(g *libkb.GlobalContext) *fakeIdentifyUI {
	var tb *keybase1.IdentifyTrackBreaks
	return &fakeIdentifyUI{
		engine.NewLoopbackIdentifyUI(g, &tb),
	}
}

func RunTrack(tc libkb.TestContext, fu *FakeUser, username string) (them *libkb.User, err error) {
	sv := keybase1.SigVersion(2)
	return RunTrackWithOptions(tc, fu, username, keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI(), false)
}

func RunTrackWithOptions(tc libkb.TestContext, fu *FakeUser, username string, options keybase1.TrackOptions, secretUI libkb.SecretUI, forceRemoteCheck bool) (them *libkb.User, err error) {
	idUI := newFakeIdentifyUI(tc.G)

	arg := &engine.TrackEngineArg{
		UserAssertion:    username,
		Options:          options,
		ForceRemoteCheck: forceRemoteCheck,
	}
	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   secretUI,
	}
	eng := engine.NewTrackEngine(tc.G, arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	them = eng.User()
	return them, err
}

// GenerateTestPhoneNumber generates a random phone number in US with 555 area
// code. It passes serverside "strict phone number" checker test, and it's
// considered `possible`, but not `valid` by libphonenumber.
func GenerateTestPhoneNumber() string {
	ret := make([]byte, 7)
	rand.Read(ret)
	for i := range ret {
		ret[i] = "0123456789"[int(ret[i])%10]
	}
	return fmt.Sprintf("1555%s", string(ret))
}

type getCodeResponse struct {
	libkb.AppStatusEmbed
	VerificationCode string `json:"verification_code"`
}

func GetPhoneVerificationCode(mctx libkb.MetaContext, phoneNumber keybase1.PhoneNumber) (code string, err error) {
	arg := libkb.APIArg{
		Endpoint:    "test/phone_number_code",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"phone_number": libkb.S{Val: phoneNumber.String()},
		},
	}
	var resp getCodeResponse
	err = mctx.G().API.GetDecode(arg, &resp)
	if err != nil {
		return "", err
	}
	return resp.VerificationCode, nil
}

func VerifyEmailAuto(mctx libkb.MetaContext, email string) error {
	arg := libkb.APIArg{
		Endpoint:    "test/verify_email_auto",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"email": libkb.S{Val: email},
		},
	}
	_, err := mctx.G().API.Post(arg)
	return err
}
