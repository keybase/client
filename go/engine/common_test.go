// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
	"github.com/stretchr/testify/require"
)

func SetupEngineTest(tb libkb.TestingTB, name string) libkb.TestContext {
	tc := externalstest.SetupTest(tb, name, 2)

	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, warner, isProduction)
	}

	return tc
}

func SetupEngineTestRealTriplesec(tb libkb.TestingTB, name string) libkb.TestContext {
	tc := externalstest.SetupTest(tb, name, 2)
	tc.G.NewTriplesec = libkb.NewSecureTriplesec
	return tc
}

type FakeUser struct {
	Username      string
	Email         string
	Passphrase    string
	User          *libkb.User
	EncryptionKey libkb.GenericKey
	DeviceName    string
}

func NewFakeUser(prefix string) (fu *FakeUser, err error) {
	buf := make([]byte, 5)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	username := fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
	email := fmt.Sprintf("%s@noemail.keybase.io", username)
	buf = make([]byte, 12)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	passphrase := hex.EncodeToString(buf)
	fu = &FakeUser{Username: username, Email: email, Passphrase: passphrase}
	return
}

func (fu FakeUser) NormalizedUsername() libkb.NormalizedUsername {
	return libkb.NewNormalizedUsername(fu.Username)
}

func (fu *FakeUser) LoadUser(tc libkb.TestContext) error {
	var err error
	fu.User, err = libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	return err
}

func (fu FakeUser) UID() keybase1.UID {
	// All new-style names will have a 1-to-1 mapping
	return libkb.UsernameToUID(fu.Username)
}

func NewFakeUserOrBust(tb libkb.TestingTB, prefix string) (fu *FakeUser) {
	var err error
	if fu, err = NewFakeUser(prefix); err != nil {
		tb.Fatal(err)
	}
	return fu
}

const defaultDeviceName = "my device"

// MakeTestSignupEngineRunArg fills a SignupEngineRunArg with the most
// common parameters for testing and returns it.
func MakeTestSignupEngineRunArg(fu *FakeUser) SignupEngineRunArg {
	return SignupEngineRunArg{
		Username:    fu.Username,
		Email:       fu.Email,
		InviteCode:  libkb.TestInvitationCode,
		Passphrase:  fu.Passphrase,
		StoreSecret: false,
		DeviceName:  defaultDeviceName,
		SkipGPG:     true,
		SkipMail:    true,
		SkipPaper:   true,
	}
}

func SignupFakeUserWithArg(tc libkb.TestContext, fu *FakeUser, arg SignupEngineRunArg) *SignupEngine {
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, &arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, s)
	if err != nil {
		tc.T.Fatal(err)
	}
	fu.EncryptionKey = s.encryptionKey
	return s
}

func CreateAndSignupFakeUser(tc libkb.TestContext, prefix string) *FakeUser {
	fu, _ := CreateAndSignupFakeUser2(tc, prefix)
	return fu
}

func CreateAndSignupFakeUser2(tc libkb.TestContext, prefix string) (*FakeUser, *SignupEngine) {
	fu := NewFakeUserOrBust(tc.T, prefix)
	tc.G.Log.Debug("New test user: %s / %s", fu.Username, fu.Email)
	arg := MakeTestSignupEngineRunArg(fu)
	fu.DeviceName = arg.DeviceName
	eng := SignupFakeUserWithArg(tc, fu, arg)
	return fu, eng
}

func CreateAndSignupFakeUserPaper(tc libkb.TestContext, prefix string) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, prefix)
	tc.G.Log.Debug("New test user: %s / %s", fu.Username, fu.Email)
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	_ = SignupFakeUserWithArg(tc, fu, arg)
	return fu
}

func CreateAndSignupFakeUserSafeWithArg(g *libkb.GlobalContext, fu *FakeUser, arg SignupEngineRunArg) (*FakeUser, error) {
	uis := libkb.UIs{
		LogUI:    g.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(g, &arg)
	err := RunEngine2(libkb.NewMetaContextTODO(g).WithUIs(uis), s)
	if err != nil {
		return nil, err
	}
	return fu, nil
}

func CreateAndSignupFakeUserSafe(g *libkb.GlobalContext, prefix string) (*FakeUser, error) {
	fu, err := NewFakeUser(prefix)
	if err != nil {
		return nil, err
	}
	arg := MakeTestSignupEngineRunArg(fu)

	return CreateAndSignupFakeUserSafeWithArg(g, fu, arg)
}

func CreateAndSignupFakeUserGPG(tc libkb.TestContext, prefix string) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, prefix)
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		tc.T.Fatal(err)
	}
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipGPG = false
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, &arg)
	err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s)
	if err != nil {
		tc.T.Fatal(err)
	}
	return fu
}

func SignupFakeUserStoreSecret(tc libkb.TestContext, prefix string) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, prefix)
	tc.G.Log.Debug("New test user: %s / %s", fu.Username, fu.Email)
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	arg.StoreSecret = true
	_ = SignupFakeUserWithArg(tc, fu, arg)
	return fu
}

func CreateAndSignupFakeUserCustomArg(tc libkb.TestContext, prefix string, fmod func(*SignupEngineRunArg)) (fu *FakeUser, signingKey libkb.GenericKey, encryptionKey libkb.NaclDHKeyPair) {
	fu = NewFakeUserOrBust(tc.T, prefix)
	arg := MakeTestSignupEngineRunArg(fu)
	fmod(&arg)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(tc.G, &arg)
	err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s)
	if err != nil {
		tc.T.Fatal(err)
	}
	return fu, s.signingKey, s.encryptionKey
}

func CreateAndSignupFakeUserWithPassphrase(tc libkb.TestContext, prefix, passphrase string) *FakeUser {
	fu := NewFakeUserOrBust(tc.T, prefix)
	fu.Passphrase = passphrase
	tc.G.Log.Debug("New test user: %s / %s", fu.Username, fu.Email)
	arg := MakeTestSignupEngineRunArg(fu)
	SignupFakeUserWithArg(tc, fu, arg)
	return fu
}

func (fu *FakeUser) LoginWithSecretUI(secui libkb.SecretUI, g *libkb.GlobalContext) error {
	uis := libkb.UIs{
		ProvisionUI: newTestProvisionUI(),
		LogUI:       g.UI.GetLogUI(),
		GPGUI:       &gpgtestui{},
		SecretUI:    secui,
		LoginUI:     &libkb.TestLoginUI{Username: fu.Username},
	}
	m := libkb.NewMetaContextTODO(g).WithUIs(uis)
	li := NewLogin(g, libkb.DeviceTypeDesktop, fu.Username, keybase1.ClientType_CLI)
	return RunEngine2(m, li)
}

func (fu *FakeUser) Login(g *libkb.GlobalContext) error {
	s := fu.NewSecretUI()
	return fu.LoginWithSecretUI(s, g)
}

func (fu *FakeUser) LoginOrBust(tc libkb.TestContext) {
	if err := fu.Login(tc.G); err != nil {
		tc.T.Fatal(err)
	}
}

func (fu *FakeUser) NewSecretUI() *libkb.TestSecretUI {
	return &libkb.TestSecretUI{Passphrase: fu.Passphrase}
}

func (fu *FakeUser) NewCountSecretUI() *libkb.TestCountSecretUI {
	return &libkb.TestCountSecretUI{Passphrase: fu.Passphrase}
}

func AssertProvisioned(tc libkb.TestContext) error {
	m := NewMetaContextForTest(tc)
	prov, err := isLoggedInWithError(m)
	if err != nil {
		return err
	}
	if !prov {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func AssertNotProvisioned(tc libkb.TestContext) error {
	m := NewMetaContextForTest(tc)
	prov, err := isLoggedInWithError(m)
	if err != nil {
		return err
	}
	if prov {
		return errors.New("AssertNotProvisioned failed: user is provisioned")
	}
	return nil
}

func AssertLoggedIn(tc libkb.TestContext) error {
	if !LoggedIn(tc) {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func AssertLoggedOut(tc libkb.TestContext) error {
	if LoggedIn(tc) {
		return libkb.LogoutError{}
	}
	return nil
}

func LoggedIn(tc libkb.TestContext) bool {
	return tc.G.ActiveDevice.Valid()
}

func Logout(tc libkb.TestContext) {
	if err := tc.G.Logout(); err != nil {
		tc.T.Fatalf("logout error: %s", err)
	}
}

// TODO: Add tests that use testEngineWithSecretStore for every engine
// that should work with the secret store.

// testEngineWithSecretStore takes a given engine-running function and
// makes sure that it works with the secret store, i.e. that it stores
// data into it when told to and reads data out from it.
func testEngineWithSecretStore(
	t *testing.T,
	runEngine func(libkb.TestContext, *FakeUser, libkb.SecretUI)) {

	tc := SetupEngineTest(t, "wss")
	defer tc.Cleanup()

	fu := SignupFakeUserStoreSecret(tc, "wss")
	tc.SimulateServiceRestart()

	testSecretUI := libkb.TestSecretUI{
		Passphrase:  fu.Passphrase,
		StoreSecret: true,
	}
	runEngine(tc, fu, &testSecretUI)

	if testSecretUI.CalledGetPassphrase {
		t.Fatal("GetPassphrase() unexpectedly called")
	}
}

func SetupTwoDevices(t *testing.T, nm string) (user *FakeUser, dev1 libkb.TestContext, dev2 libkb.TestContext, cleanup func()) {
	return SetupTwoDevicesWithHook(t, nm, nil)
}

func SetupTwoDevicesWithHook(t *testing.T, nm string, hook func(tc *libkb.TestContext)) (user *FakeUser, dev1 libkb.TestContext, dev2 libkb.TestContext, cleanup func()) {
	if len(nm) > 5 {
		t.Fatalf("Sorry, test name must be fewer than 6 chars (got %q)", nm)
	}

	// device X (provisioner) context:
	dev1 = SetupEngineTest(t, nm)

	// device Y (provisionee) context:
	dev2 = SetupEngineTest(t, nm)
	if hook != nil {
		hook(&dev2)
	}

	user = NewFakeUserOrBust(t, nm)
	arg := MakeTestSignupEngineRunArg(user)
	arg.SkipPaper = false
	loginUI := &paperLoginUI{Username: user.Username}
	uis := libkb.UIs{
		LogUI:    dev1.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: user.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(dev1.G, &arg)
	err := RunEngine2(NewMetaContextForTest(dev1).WithUIs(uis), s)
	if err != nil {
		t.Fatal(err)
	}

	assertNumDevicesAndKeys(dev1, user, 2, 4)

	if len(loginUI.PaperPhrase) == 0 {
		t.Fatal("login ui has no paper key phrase")
	}

	secUI := user.NewSecretUI()
	secUI.Passphrase = loginUI.PaperPhrase
	provUI := newTestProvisionUIPaper()
	provLoginUI := &libkb.TestLoginUI{Username: user.Username}
	uis = libkb.UIs{
		ProvisionUI: provUI,
		LogUI:       dev2.G.UI.GetLogUI(),
		SecretUI:    secUI,
		LoginUI:     provLoginUI,
		GPGUI:       &gpgtestui{},
	}
	eng := NewLogin(dev2.G, libkb.DeviceTypeDesktop, "", keybase1.ClientType_CLI)
	m2 := NewMetaContextForTest(dev2).WithUIs(uis)
	if err := RunEngine2(m2, eng); err != nil {
		t.Fatal(err)
	}

	testUserHasDeviceKey(dev2)

	assertNumDevicesAndKeys(dev2, user, 3, 6)

	if err := AssertProvisioned(dev2); err != nil {
		t.Fatal(err)
	}

	cleanup = func() {
		dev1.Cleanup()
		dev2.Cleanup()
	}

	return user, dev1, dev2, cleanup
}

func NewMetaContextForTest(tc libkb.TestContext) libkb.MetaContext {
	return libkb.NewMetaContextForTest(tc)
}
func NewMetaContextForTestWithLogUI(tc libkb.TestContext) libkb.MetaContext {
	return libkb.NewMetaContextForTestWithLogUI(tc)
}

func ResetAccount(tc libkb.TestContext, u *FakeUser) {
	ResetAccountNoLogout(tc, u)
	Logout(tc)
}

func ResetAccountNoLogout(tc libkb.TestContext, u *FakeUser) {
	m := NewMetaContextForTest(tc)
	err := libkb.ResetAccount(m, u.NormalizedUsername(), u.Passphrase)
	if err != nil {
		tc.T.Fatalf("In account reset: %s", err)
	}
	tc.T.Logf("Account reset for user %s", u.Username)
}

func ForcePUK(tc libkb.TestContext) {
	arg := &PerUserKeyUpgradeArgs{}
	eng := NewPerUserKeyUpgrade(tc.G, arg)
	uis := libkb.UIs{
		LogUI: tc.G.UI.GetLogUI(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		tc.T.Fatal(err)
	}
}

func getUserSeqno(tc *libkb.TestContext, uid keybase1.UID) keybase1.Seqno {
	m := NewMetaContextForTest(*tc)
	res, err := tc.G.API.Get(m, libkb.APIArg{
		Endpoint: "user/lookup",
		Args: libkb.HTTPArgs{
			"uid": libkb.UIDArg(uid),
		},
	})
	require.NoError(tc.T, err)
	seqno, err := res.Body.AtKey("them").AtKey("sigs").AtKey("last").AtKey("seqno").GetInt()
	require.NoError(tc.T, err)
	return keybase1.Seqno(seqno)
}

func checkUserSeqno(tc *libkb.TestContext, uid keybase1.UID, expected keybase1.Seqno) {
	require.Equal(tc.T, expected, getUserSeqno(tc, uid))
}

func fakeSalt() []byte {
	return []byte("fakeSALTfakeSALT")
}

func clearCaches(g *libkb.GlobalContext) {
	g.ActiveDevice.ClearCaches()
}
