package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

// Test login switching between two different users.
func TestLoginAndSwitch(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(tc, "login")
	tc.G.Logout()
	u2 := CreateAndSignupFakeUser(tc, "login")
	tc.G.Logout()
	u1.LoginOrBust(tc)
	tc.G.Logout()
	u2.LoginOrBust(tc)

	return
}

func TestLoginFakeUserNoKeys(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	createFakeUserWithNoKeys(tc)

	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}

	kf := me.GetKeyFamily()
	if kf == nil {
		t.Fatal("user has a nil key family")
	}
	if me.GetEldestFOKID() != nil {
		t.Fatalf("user has an eldest key, they should have no keys: %s", me.GetEldestFOKID())
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

func testUserHasDeviceKey(t *testing.T) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}

	kf := me.GetKeyFamily()
	if kf == nil {
		t.Fatal("user has a nil key family")
	}
	if me.GetEldestFOKID() == nil {
		t.Fatal("user has no eldest key")
	}

	ckf := me.GetComputedKeyFamily()
	if ckf == nil {
		t.Fatalf("user has no computed key family")
	}

	active := ckf.HasActiveKey()
	if !active {
		t.Errorf("user has no active key")
	}

	subkey, err := me.GetDeviceSubkey()
	if err != nil {
		t.Fatal(err)
	}
	if subkey == nil {
		t.Fatal("nil subkey")
	}
}

func TestLoginAddsKeys(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(tc)

	tc.G.Logout()

	li := NewLoginWithPromptEngine(username, tc.G)
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), LocksmithUI: &lockui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(t)
}

func TestLoginDetKeyOnly(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithDetKey(tc)

	tc.G.Logout()

	li := NewLoginWithPromptEngine(username, tc.G)
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), LocksmithUI: &lockui{}, SecretUI: secui, GPGUI: &gpgtestui{}, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have a device key, login should have fixed that:
	testUserHasDeviceKey(t)
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
	tc.G.Logout()
	tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	docui := &lockuiPGP{&lockui{}}

	before := docui.selectSignerCount

	li := NewLoginWithPromptEngine(u1.Username, tc2.G)
	secui := libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       tc.G.UI.GetLogUI(),
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

	testUserHasDeviceKey(t)
}

func TestLoginPGPPubOnlySignNewDevice(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	u1 := createFakeUserWithPGPPubOnly(t, tc)
	tc.G.Logout()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := tc.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	// now safe to cleanup first home
	tc.Cleanup()

	docui := &lockuiPGP{&lockui{}}

	before := docui.selectSignerCount

	li := NewLoginWithPromptEngine(u1.Username, tc2.G)
	secui := libkb.TestSecretUI{Passphrase: u1.Passphrase}
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

	testUserHasDeviceKey(t)
}

func TestLoginPGPMultSignNewDevice(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	u1 := createFakeUserWithPGPMult(t, tc)
	tc.G.Logout()
	defer tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := tc.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	docui := &lockuiPGP{&lockui{}}

	before := docui.selectSignerCount

	li := NewLoginWithPromptEngine(u1.Username, tc2.G)
	secui := libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       tc2.G.UI.GetLogUI(),
		LocksmithUI: docui,
		GPGUI:       &gpgtestui{1},
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

	testUserHasDeviceKey(t)
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

	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	tk, err := tc.G.LoginState().GetPassphraseStream(secui)
	if err != nil {
		t.Fatal(err)
	}
	lks := libkb.NewLKSec(tk.LksClientHalf(), tc.G)

	tc.G.Logout()

	// going to register a device only, not generating the device keys.
	dregArgs := &DeviceRegisterArgs{
		Me:   me,
		Name: "my new device",
		Lks:  lks,
	}
	dreg := NewDeviceRegister(dregArgs, tc.G)
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), LocksmithUI: &lockui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
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
	testUserHasDeviceKey(t)
}

// TestLoginInterruptDevicePush interrupts before pushing device
// keys and then tests that login corrects the situation on the
// next attempt.
func TestLoginInterruptDevicePush(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(tc)

	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	tk, err := tc.G.LoginState().GetPassphraseStream(secui)
	if err != nil {
		t.Fatal(err)
	}
	lks := libkb.NewLKSec(tk.LksClientHalf(), tc.G)

	// going to register a device only, not generating the device keys.
	dregArgs := &DeviceRegisterArgs{
		Me:   me,
		Name: "my new device",
		Lks:  lks,
	}
	dreg := NewDeviceRegister(dregArgs, tc.G)
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), LocksmithUI: &lockui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(dreg, ctx); err != nil {
		t.Fatal(err)
	}

	// now generate device keys but don't push them.
	dkeyArgs := &DeviceKeygenArgs{
		Me:         me,
		DeviceID:   dreg.DeviceID(),
		DeviceName: dregArgs.Name,
		Lks:        lks,
	}
	dkey := NewDeviceKeygen(dkeyArgs, tc.G)
	if err := RunEngine(dkey, ctx); err != nil {
		t.Fatal(err)
	}

	tc.G.Logout()

	// now login and see if it correctly generates needed keys
	li := NewLoginWithPassphraseEngine(username, passphrase, false, tc.G)
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(t)
}

func TestUserInfo(t *testing.T) {
	t.Skip()
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	var username string
	var err error
	tc.G.LoginState().Account(func(a *libkb.Account) {
		_, username, _, _, err = a.UserInfo()
	}, "TestUserInfo")
	if err != nil {
		t.Fatal(err)
	}
	if username != u.Username {
		t.Errorf("userinfo username: %q, expected %q", username, u.Username)
	}
}

type lockui struct {
	selectSignerCount int
}

func (l *lockui) PromptDeviceName(dummy int) (string, error) {
	return "my test device", nil
}

func (l *lockui) SelectSigner(arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase1.SelectSignerAction_SIGN
	devid, err := libkb.NewDeviceID()
	if err != nil {
		return
	}
	sdev := devid.String()
	res.Signer = &keybase1.DeviceSigner{Kind: keybase1.DeviceSignerKind_DEVICE, DeviceID: &sdev}
	return
}

func (l *lockui) DeviceSignAttemptErr(arg keybase1.DeviceSignAttemptErrArg) error {
	return nil
}

func (l *lockui) DisplaySecretWords(arg keybase1.DisplaySecretWordsArg) error {
	return nil
}

func (l *lockui) KexStatus(arg keybase1.KexStatusArg) error {
	return nil
}

type lockuiPGP struct {
	*lockui
}

func (l *lockuiPGP) SelectSigner(arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase1.SelectSignerAction_SIGN
	res.Signer = &keybase1.DeviceSigner{Kind: keybase1.DeviceSignerKind_PGP}
	return
}
