package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

// Test login switching between two different users.
func TestLoginAndSwitch(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u1 := CreateAndSignupFakeUser(t, "login")
	G.Logout()
	u2 := CreateAndSignupFakeUser(t, "login")
	G.Logout()
	u1.LoginOrBust(t)
	G.Logout()
	u2.LoginOrBust(t)

	return
}

func TestLoginFakeUserNoKeys(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	createFakeUserWithNoKeys(t)

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

	dsk, err := me.GetDeviceSibkey()
	if err != nil {
		t.Fatal(err)
	}
	if dsk == nil {
		t.Fatal("nil sibkey")
	}
}

func TestLoginAddsKeys(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(t)

	G.Logout()

	li := NewLoginWithPromptEngine(username)
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: &lockui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.LoginState().AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(t)
}

func TestLoginDetKeyOnly(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithDetKey(t)

	G.Logout()

	li := NewLoginWithPromptEngine(username)
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: &lockui{}, SecretUI: secui, GPGUI: &gpgtestui{}, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.LoginState().AssertLoggedIn(); err != nil {
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
	G.Logout()
	tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	docui := &lockuiPGP{&lockui{}}

	before := docui.selectSignerCount

	li := NewLoginWithPromptEngine(u1.Username)
	secui := libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       G.UI.GetLogUI(),
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
	G.Logout()

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

	li := NewLoginWithPromptEngine(u1.Username)
	secui := libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       G.UI.GetLogUI(),
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
	G.Logout()
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

	li := NewLoginWithPromptEngine(u1.Username)
	secui := libkb.TestSecretUI{Passphrase: u1.Passphrase}
	ctx := &Context{
		LogUI:       G.UI.GetLogUI(),
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

	username, passphrase := createFakeUserWithNoKeys(t)

	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	tk, err := G.LoginState().GetPassphraseStream(secui)
	if err != nil {
		t.Fatal(err)
	}
	lks := libkb.NewLKSec(tk.LksClientHalf(), G)

	G.Logout()

	// going to register a device only, not generating the device keys.
	dregArgs := &DeviceRegisterArgs{
		Me:   me,
		Name: "my new device",
		Lks:  lks,
	}
	dreg := NewDeviceRegister(dregArgs)
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: &lockui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(dreg, ctx); err != nil {
		t.Fatal(err)
	}

	// now login and see if it correctly generates needed keys
	li := NewLoginWithPassphraseEngine(username, passphrase, false)
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.LoginState().AssertLoggedIn(); err != nil {
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

	username, passphrase := createFakeUserWithNoKeys(t)

	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	tk, err := G.LoginState().GetPassphraseStream(secui)
	if err != nil {
		t.Fatal(err)
	}
	lks := libkb.NewLKSec(tk.LksClientHalf(), G)

	// going to register a device only, not generating the device keys.
	dregArgs := &DeviceRegisterArgs{
		Me:   me,
		Name: "my new device",
		Lks:  lks,
	}
	dreg := NewDeviceRegister(dregArgs)
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: &lockui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
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
	dkey := NewDeviceKeygen(dkeyArgs)
	if err := RunEngine(dkey, ctx); err != nil {
		t.Fatal(err)
	}

	G.Logout()

	// now login and see if it correctly generates needed keys
	li := NewLoginWithPassphraseEngine(username, passphrase, false)
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.LoginState().AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(t)
}

type lockui struct {
	selectSignerCount int
}

func (l *lockui) PromptDeviceName(dummy int) (string, error) {
	return "my test device", nil
}

func (l *lockui) SelectSigner(arg keybase_1.SelectSignerArg) (res keybase_1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase_1.SelectSignerAction_SIGN
	devid, err := libkb.NewDeviceID()
	if err != nil {
		return
	}
	sdev := devid.String()
	res.Signer = &keybase_1.DeviceSigner{Kind: keybase_1.DeviceSignerKind_DEVICE, DeviceID: &sdev}
	return
}

func (l *lockui) DisplaySecretWords(arg keybase_1.DisplaySecretWordsArg) error {
	return nil
}

func (l *lockui) KexStatus(arg keybase_1.KexStatusArg) error {
	return nil
}

type lockuiPGP struct {
	*lockui
}

func (l *lockuiPGP) SelectSigner(arg keybase_1.SelectSignerArg) (res keybase_1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase_1.SelectSignerAction_SIGN
	res.Signer = &keybase_1.DeviceSigner{Kind: keybase_1.DeviceSignerKind_PGP}
	return
}
