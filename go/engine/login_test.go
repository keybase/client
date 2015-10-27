package engine

import (
	"errors"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// Test login switching between two different users.
func TestLoginAndSwitch(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u2 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u1.LoginOrBust(tc)
	Logout(tc)
	u2.LoginOrBust(tc)

	return
}

func TestLoginFakeUserNoKeys(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	createFakeUserWithNoKeys(tc)

	me, err := libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}

	kf := me.GetKeyFamily()
	if kf == nil {
		t.Fatal("user has a nil key family")
	}
	if me.GetEldestKID().Exists() {
		t.Fatalf("user has an eldest key, they should have no keys: %s", me.GetEldestKID())
	}

	ckf := me.GetComputedKeyFamily()
	if ckf != nil {
		t.Errorf("user has a computed key family.  they shouldn't...")

		active := me.GetComputedKeyFamily().HasActiveKey()
		if active {
			t.Errorf("user has an active key, but they should have no keys")
		}
	}
}

func testUserHasDeviceKey(tc libkb.TestContext) {
	me, err := libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	if err != nil {
		tc.T.Fatal(err)
	}

	kf := me.GetKeyFamily()
	if kf == nil {
		tc.T.Fatal("user has a nil key family")
	}
	if me.GetEldestKID().IsNil() {
		tc.T.Fatal("user has no eldest key")
	}

	ckf := me.GetComputedKeyFamily()
	if ckf == nil {
		tc.T.Fatalf("user has no computed key family")
	}

	active := ckf.HasActiveKey()
	if !active {
		tc.T.Errorf("user has no active key")
	}

	subkey, err := me.GetDeviceSubkey()
	if err != nil {
		tc.T.Fatal(err)
	}
	if subkey == nil {
		tc.T.Fatal("nil subkey")
	}
}

func TestLoginAddsKeys(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(tc)

	Logout(tc)

	li := NewLoginWithPromptEngine(username, tc.G)
	secui := &libkb.TestSecretUI{Passphrase: passphrase}
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), LocksmithUI: &lockui{deviceName: "Device"}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(tc)

	// and they should have a paper backup key
	hasOnePaperDev(tc, &FakeUser{Username: username, Passphrase: passphrase})
}

// TestLoginPGPSignNewDevice
//
//  Setup: Create a new user who only has a Sync'ed PGP key, like our typical
//    web user who has never used PGP.
//  Step 1: Sign into a "new device" and authorize new keys with the synced
//    PGP key.
//
func TestLoginPGPSignNewDevice(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	u1 := createFakeUserWithPGPOnly(t, tc)
	Logout(tc)
	tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	docui := &lockuiPGP{&lockui{deviceName: "PGP Device"}}

	before := docui.selectSignerCount

	li := NewLoginWithPromptEngine(u1.Username, tc2.G)
	secui := &libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		SecretUI:    secui,
		GPGUI:       &gpgtestui{},
		LoginUI:     &libkb.TestLoginUI{},
	}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	after := docui.selectSignerCount
	if after-before != 0 {
		t.Errorf("doc ui SelectSigner called %d times, expected 0", after-before)
	}

	testUserHasDeviceKey(tc2)
	hasOnePaperDev(tc2, u1)
}

func TestLoginPGPPubOnlySignNewDevice(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	u1 := createFakeUserWithPGPPubOnly(t, tc)
	Logout(tc)

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := tc.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	// now safe to cleanup first home
	tc.Cleanup()

	docui := &lockuiPGP{&lockui{deviceName: "Device"}}

	before := docui.selectSignerCount

	li := NewLoginWithPromptEngine(u1.Username, tc2.G)
	secui := &libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		SecretUI:    secui,
		GPGUI:       &gpgtestui{},
		LoginUI:     &libkb.TestLoginUI{},
	}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	after := docui.selectSignerCount
	if after-before != 1 {
		t.Errorf("doc ui SelectSigner called %d times, expected 1", after-before)
	}

	testUserHasDeviceKey(tc2)
	hasOnePaperDev(tc2, u1)
}

func TestLoginPGPMultSignNewDevice(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	u1 := createFakeUserWithPGPMult(t, tc)
	Logout(tc)
	defer tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := tc.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	docui := &lockuiPGP{&lockui{deviceName: "Device"}}

	before := docui.selectSignerCount

	li := NewLoginWithPromptEngine(u1.Username, tc2.G)
	secui := &libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		GPGUI:       &gpgtestui{1, 0},
		SecretUI:    secui,
		LoginUI:     &libkb.TestLoginUI{Username: u1.Username},
	}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	after := docui.selectSignerCount
	if after-before != 1 {
		t.Errorf("doc ui SelectSigner called %d times, expected 1", after-before)
	}

	testUserHasDeviceKey(tc2)
	hasOnePaperDev(tc2, u1)
}

// pgp sibkey used to sign new device
func TestLoginGPGSignNewDevice(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	u1 := CreateAndSignupFakeUserGPG(tc, "pgp")
	Logout(tc)

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := tc.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	// now safe to cleanup first home
	tc.Cleanup()

	docui := &lockuiPGP{&lockui{deviceName: "Device"}}

	before := docui.selectSignerCount

	li := NewLoginWithPromptEngine(u1.Username, tc2.G)
	secui := &libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		SecretUI:    secui,
		GPGUI:       &gpgtestui{},
		LoginUI:     &libkb.TestLoginUI{},
	}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	after := docui.selectSignerCount
	if after-before != 1 {
		t.Errorf("doc ui SelectSigner called %d times, expected 1", after-before)
	}

	testUserHasDeviceKey(tc2)
	hasOnePaperDev(tc2, u1)
}

// paper backup key used to sign new device
func TestLoginPaperSignNewDevice(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()
	fu := NewFakeUserOrBust(t, "paper")
	arg := MakeTestSignupEngineRunArg(fu)
	loginUI := &paperLoginUI{Username: fu.Username}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(&arg, tc.G)
	err := RunEngine(s, ctx)
	if err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(tc, fu, 2, 4)

	Logout(tc)

	if len(loginUI.PaperPhrase) == 0 {
		t.Fatal("login ui has no paper key phrase")
	}

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	locksmithUI := &lockuiPaper{&lockui{deviceName: "new device paper sign"}}

	before := locksmithUI.selectSignerCount

	secui := fu.NewSecretUI()
	secui.BackupPassphrase = loginUI.PaperPhrase

	li := NewLoginWithPromptEngine(fu.Username, tc2.G)
	ctx = &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: locksmithUI,
		SecretUI:    secui,
		GPGUI:       &gpgtestui{},
		LoginUI:     &libkb.TestLoginUI{},
	}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	after := locksmithUI.selectSignerCount
	if after-before != 1 {
		t.Errorf("doc ui SelectSigner called %d times, expected 1", after-before)
	}

	testUserHasDeviceKey(tc2)

	assertNumDevicesAndKeys(tc, fu, 3, 6)
}

// TestLoginInterrupt* tries to simulate what would happen if the
// locksmith login checkup gets interrupted.  See Issue #287.

// TestLoginInterruptDeviceRegister interrupts after registering a
// device and then tests that login corrects the situation on the
// next attempt.
func TestLoginInterruptDeviceRegister(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(tc)

	me, err := libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	secui := &libkb.TestSecretUI{Passphrase: passphrase}
	pps, err := tc.G.LoginState().GetPassphraseStream(secui)
	if err != nil {
		t.Fatal(err)
	}
	lks := libkb.NewLKSec(pps, me.GetUID(), tc.G)

	Logout(tc)

	// going to register a device only, not generating the device keys.
	dregArgs := &DeviceRegisterArgs{
		Me:   me,
		Name: "my new device",
		Lks:  lks,
	}
	dreg := NewDeviceRegister(dregArgs, tc.G)
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), LocksmithUI: &lockui{deviceName: "Device"}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(dreg, ctx); err != nil {
		t.Fatal(err)
	}

	// now login and see if it correctly generates needed keys
	li := NewLoginWithPassphraseEngine(username, passphrase, false, tc.G)
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(tc)
}

// TestLoginInterruptDevicePush interrupts before pushing device
// keys and then tests that login corrects the situation on the
// next attempt.
func TestLoginInterruptDevicePush(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(tc)

	me, err := libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	secui := &libkb.TestSecretUI{Passphrase: passphrase}
	pps, err := tc.G.LoginState().GetPassphraseStream(secui)
	if err != nil {
		t.Fatal(err)
	}
	lks := libkb.NewLKSec(pps, me.GetUID(), tc.G)

	// going to register a device only, not generating the device keys.
	dregArgs := &DeviceRegisterArgs{
		Me:   me,
		Name: "my new device",
		Lks:  lks,
	}
	dreg := NewDeviceRegister(dregArgs, tc.G)
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), LocksmithUI: &lockui{deviceName: "Device"}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(dreg, ctx); err != nil {
		t.Fatal(err)
	}

	// now generate device keys but don't push them.
	dkeyArgs := &DeviceKeygenArgs{
		Me:         me,
		DeviceID:   dreg.DeviceID(),
		DeviceName: dregArgs.Name,
		DeviceType: libkb.DeviceTypeDesktop,
		Lks:        lks,
	}
	dkey := NewDeviceKeygen(dkeyArgs, tc.G)
	if err := RunEngine(dkey, ctx); err != nil {
		t.Fatal(err)
	}

	Logout(tc)

	// now login and see if it correctly generates needed keys
	li := NewLoginWithPassphraseEngine(username, passphrase, false, tc.G)
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(tc)
}

// TestLoginRestartProvision
//
// 1. Signup via the web and push a private pgp key
// 2. Login w/ go client.  Enter passphrase and get a session, but
//    don't complete the device provisioning.
// 3. Kill the daemon (`ctl stop`, reboot computer, etc.)
// 4. Login w/ go client again.  Should get logged out and ReloginRequiredError.
// 5. Login w/ go client.  Everything should work.
//
// This test should replicate that scenario.  While rare, we
// should make it work.
//
func TestLoginRestartProvision(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	// 1. Signup via the "web" and push a private pgp key
	u1 := createFakeUserWithPGPOnly(t, tc)
	Logout(tc)
	tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	docui := &lockuiPGP{&lockui{deviceName: "PGP Device"}}

	// 2. Login w/ go client.  Enter passphrase and get a session, but
	//    don't complete the device provisioning.
	li := NewLoginWithPromptEngineSkipLocksmith(u1.Username, tc2.G)
	ctx := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		SecretUI:    u1.NewSecretUI(),
		GPGUI:       &gpgtestui{},
		LoginUI:     &libkb.TestLoginUI{},
	}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	// 3. Clearing the stream cache is the issue when daemon restarts.
	//    Doing a logout here would be too clean, and the next login would
	//    work fine.
	tc2.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	// 4. Log in again
	li2 := NewLoginWithPromptEngine(u1.Username, tc2.G)
	ctx2 := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		SecretUI:    u1.NewSecretUI(),
		GPGUI:       &gpgtestui{},
		LoginUI:     &libkb.TestLoginUI{},
	}
	err := RunEngine(li2, ctx2)
	if err == nil {
		t.Fatal("expected relogin error, got nil")
	}
	if _, ok := err.(libkb.ReloginRequiredError); !ok {
		t.Fatalf("expected relogin error, got %T", err)
	}

	// login engine should logout the user before a relogin error.
	if err := AssertLoggedOut(tc2); err != nil {
		t.Fatal(err)
	}

	// this login attempt should finally work:
	li3 := NewLoginWithPromptEngine(u1.Username, tc2.G)
	ctx3 := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		SecretUI:    u1.NewSecretUI(),
		GPGUI:       &gpgtestui{},
		LoginUI:     &libkb.TestLoginUI{},
	}
	if err := RunEngine(li3, ctx3); err != nil {
		t.Fatal(err)
	}

	// and they should have their device keys and paper device
	testUserHasDeviceKey(tc2)
	hasOnePaperDev(tc2, u1)
}

func TestUserInfo(t *testing.T) {
	t.Skip()
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	var username libkb.NormalizedUsername
	var err error
	aerr := tc.G.LoginState().Account(func(a *libkb.Account) {
		_, username, _, _, err = a.UserInfo()
	}, "TestUserInfo")
	if aerr != nil {
		t.Fatal(err)
	}
	if err != nil {
		t.Fatal(err)
	}
	if !username.Eq(libkb.NewNormalizedUsername(u.Username)) {
		t.Errorf("userinfo username: %q, expected %q", username, u.Username)
	}
}

type lockui struct {
	selectSignerCount int
	deviceName        string
}

func (l *lockui) setDeviceName(n string) {
	l.deviceName = n
}

func (l *lockui) PromptDeviceName(_ context.Context, _ int) (string, error) {
	return l.deviceName, nil
}

func (l *lockui) DeviceNameTaken(_ context.Context, arg keybase1.DeviceNameTakenArg) error {
	return nil
}

func (l *lockui) SelectSigner(_ context.Context, arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase1.SelectSignerAction_SIGN
	devid, err := libkb.NewDeviceID()
	if err != nil {
		return
	}
	res.Signer = &keybase1.DeviceSigner{Kind: keybase1.DeviceSignerKind_DEVICE, DeviceID: &devid}
	return
}

func (l *lockui) DeviceSignAttemptErr(_ context.Context, arg keybase1.DeviceSignAttemptErrArg) error {
	return nil
}

func (l *lockui) DisplaySecretWords(_ context.Context, arg keybase1.DisplaySecretWordsArg) error {
	return nil
}

func (l *lockui) DisplayProvisionSuccess(_ context.Context, arg keybase1.DisplayProvisionSuccessArg) error {
	return nil
}

func (l *lockui) KexStatus(_ context.Context, arg keybase1.KexStatusArg) error {
	return nil
}

type lockuiPGP struct {
	*lockui
}

func (l *lockuiPGP) SelectSigner(_ context.Context, arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	l.selectSignerCount++
	if arg.HasPGP {
		res.Action = keybase1.SelectSignerAction_SIGN
		res.Signer = &keybase1.DeviceSigner{Kind: keybase1.DeviceSignerKind_PGP}
	} else {
		err = errors.New("arg.HasPGP is unexpectedly false")
	}
	return
}

type lockuiPaper struct {
	*lockui
}

func (l *lockuiPaper) SelectSigner(_ context.Context, arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase1.SelectSignerAction_SIGN
	res.Signer = &keybase1.DeviceSigner{Kind: keybase1.DeviceSignerKind_PAPER_BACKUP_KEY}
	return
}

type paperLoginUI struct {
	Username    string
	PaperPhrase string
}

func (p *paperLoginUI) GetEmailOrUsername(_ context.Context, _ int) (string, error) {
	return p.Username, nil
}

func (p *paperLoginUI) PromptRevokePaperKeys(_ context.Context, arg keybase1.PromptRevokePaperKeysArg) (bool, error) {
	return false, nil
}

func (p *paperLoginUI) DisplayPaperKeyPhrase(_ context.Context, arg keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}

func (p *paperLoginUI) DisplayPrimaryPaperKey(_ context.Context, arg keybase1.DisplayPrimaryPaperKeyArg) error {
	p.PaperPhrase = arg.Phrase
	return nil
}
