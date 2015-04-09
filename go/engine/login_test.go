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
	G.LoginState.Logout()
	u2 := CreateAndSignupFakeUser(t, "login")
	G.LoginState.Logout()
	u1.LoginOrBust(t)
	G.LoginState.Logout()
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
	if kf.GetEldest() != nil {
		t.Fatalf("user has an eldest key, they should have no keys: %s", kf.GetEldest())
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
	if kf.GetEldest() == nil {
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

	G.LoginState.Logout()

	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
	}
	li := NewLoginEngine(&larg)
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: &ldocui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(t)
}

func TestLoginDetKeyOnly(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithDetKey(t)

	G.LoginState.Logout()

	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
	}
	li := NewLoginEngine(&larg)
	secui := libkb.TestSecretUI{Passphrase: passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: &ldocui{}, SecretUI: secui, GPGUI: &gpgtestui{}, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
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
	G.LoginState.Logout()
	tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	docui := &ldocuiPGP{&ldocui{}}

	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   u1.Username,
			Passphrase: u1.Passphrase,
			NoUi:       true,
		},
	}

	before := docui.selectSignerCount

	li := NewLoginEngine(&larg)
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
	G.LoginState.Logout()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := tc.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	// now safe to cleanup first home
	tc.Cleanup()

	docui := &ldocuiPGP{&ldocui{}}

	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   u1.Username,
			Passphrase: u1.Passphrase,
			NoUi:       true,
		},
	}

	before := docui.selectSignerCount

	li := NewLoginEngine(&larg)
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
	G.LoginState.Logout()
	defer tc.Cleanup()

	// redo SetupEngineTest to get a new home directory...should look like a new device.
	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := tc.MoveGpgKeyringTo(tc2); err != nil {
		t.Fatal(err)
	}

	docui := &ldocuiPGP{&ldocui{}}

	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   u1.Username,
			Passphrase: u1.Passphrase,
			NoUi:       true,
		},
	}

	before := docui.selectSignerCount

	li := NewLoginEngine(&larg)
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
	tk, err := G.LoginState.GetPassphraseStream(secui)
	if err != nil {
		t.Fatal(err)
	}
	lks := libkb.NewLKSec(tk.LksClientHalf(), G)

	G.LoginState.Logout()

	// going to register a device only, not generating the device keys.
	dregArgs := &DeviceRegisterArgs{
		Me:   me,
		Name: "my new device",
		Lks:  lks,
	}
	dreg := NewDeviceRegister(dregArgs)
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: &ldocui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(dreg, ctx); err != nil {
		t.Fatal(err)
	}

	// now login and see if it correctly generates needed keys
	//
	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
	}
	li := NewLoginEngine(&larg)
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
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
	tk, err := G.LoginState.GetPassphraseStream(secui)
	if err != nil {
		t.Fatal(err)
	}
	lks := libkb.NewLKSec(tk.LksClientHalf(), G)

	G.LoginState.Logout()

	// going to register a device only, not generating the device keys.
	dregArgs := &DeviceRegisterArgs{
		Me:   me,
		Name: "my new device",
		Lks:  lks,
	}
	dreg := NewDeviceRegister(dregArgs)
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: &ldocui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
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

	// now login and see if it correctly generates needed keys
	//
	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
	}
	li := NewLoginEngine(&larg)
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(t)
}

type ldocui struct {
	selectSignerCount int
}

func (l *ldocui) PromptDeviceName(dummy int) (string, error) {
	return "my test device", nil
}

func (l *ldocui) SelectSigner(arg keybase_1.SelectSignerArg) (res keybase_1.SelectSignerRes, err error) {
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

func (l *ldocui) DisplaySecretWords(arg keybase_1.DisplaySecretWordsArg) error {
	return nil
}

func (l *ldocui) KexStatus(arg keybase_1.KexStatusArg) error {
	return nil
}

type ldocuiPGP struct {
	*ldocui
}

func (l *ldocuiPGP) SelectSigner(arg keybase_1.SelectSignerArg) (res keybase_1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase_1.SelectSignerAction_SIGN
	res.Signer = &keybase_1.DeviceSigner{Kind: keybase_1.DeviceSignerKind_PGP}
	return
}
