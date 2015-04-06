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

func createFakeUserWithNoKeys(t *testing.T) (username, passphrase string) {
	username, email := fakeUser(t, "login")
	passphrase = fakePassphrase(t)

	s := NewSignupEngine(nil)

	// going to just run the join step of signup engine
	if err := s.genTSPassKey(passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(username, email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	return username, passphrase
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
	ctx := &Context{LogUI: G.UI.GetLogUI(), DoctorUI: &ldocui{}, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
	testUserHasDeviceKey(t)
}

func createFakeUserWithDetKey(t *testing.T) (username, passphrase string) {
	username, email := fakeUser(t, "login")
	passphrase = fakePassphrase(t)

	s := NewSignupEngine(nil)

	if err := s.genTSPassKey(passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(username, email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	// generate the detkey only, using SelfProof
	arg := &DetKeyArgs{
		Me:        s.me,
		Tsp:       s.tspkey,
		SelfProof: true,
	}
	eng := NewDetKeyEngine(arg)
	ctx := &Context{LogUI: G.UI.GetLogUI()}
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	return username, passphrase
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
	ctx := &Context{LogUI: G.UI.GetLogUI(), DoctorUI: &ldocui{}, SecretUI: secui, GPGUI: &gpgtestui{}, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have a device key, login should have fixed that:
	testUserHasDeviceKey(t)
}

// createFakeUserWithPGPOnly creates a new fake/testing user, who signed
// up on the Web site, and used the Web site to generate his/her key.  They
// used triplesec-encryption and synced their key to the keybase servers.
func createFakeUserWithPGPOnly(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	ctx := &Context{
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LogUI:    G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	s := NewSignupEngine(nil)

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	// Generate a new test PGP key for the user, and specify the PushSecret
	// flag so that their triplesec'ed key is pushed to the server.
	gen := libkb.PGPGenArg{
		PrimaryBits: 1024,
		SubkeyBits:  1024,
	}
	gen.AddDefaultUid()
	peng := NewPGPKeyImportEngine(PGPKeyImportEngineArg{
		Gen:        &gen,
		PushSecret: true,
	})

	fu.User = s.GetMe()

	if err := RunEngine(peng, ctx); err != nil {
		t.Fatal(err)
	}

	return fu
}

// private key not pushed to server
func createFakeUserWithPGPPubOnly(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	s := NewSignupEngine(nil)
	ctx := &Context{
		GPGUI:    &gpgPubOnlyTestUI{},
		SecretUI: secui,
		LogUI:    G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	if err := s.addGPG(ctx, false); err != nil {
		t.Fatal(err)
	}

	return fu
}

// multiple pgp keys
func createFakeUserWithPGPMult(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")
	if err := tc.GenerateGPGKeyring(fu.Email, "xxx@xxx.com"); err != nil {
		t.Fatal(err)
	}

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	s := NewSignupEngine(nil)
	ctx := &Context{
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LogUI:    G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	fu.User = s.GetMe()

	// fake the lks:
	s.lks = libkb.NewLKSec(s.tspkey.LksClientHalf())
	s.lks.GenerateServerHalf()

	/*
		if err := s.registerDevice(ctx, "my root device"); err != nil {
			t.Fatal(err)
		}
	*/

	if err := s.addGPG(ctx, false); err != nil {
		t.Fatal(err)
	}

	// hack the gpg ui to select a different key:
	ctx.GPGUI = &gpgtestui{index: 1}
	if err := s.addGPG(ctx, true); err != nil {
		t.Fatal(err)
	}

	// now it should have two pgp keys...

	return fu
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
		LogUI:    G.UI.GetLogUI(),
		DoctorUI: docui,
		SecretUI: secui,
		GPGUI:    &gpgtestui{},
		LoginUI:  &libkb.TestLoginUI{},
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
		LogUI:    G.UI.GetLogUI(),
		DoctorUI: docui,
		SecretUI: secui,
		GPGUI:    &gpgtestui{},
		LoginUI:  &libkb.TestLoginUI{},
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
		LogUI:    G.UI.GetLogUI(),
		DoctorUI: docui,
		GPGUI:    &gpgtestui{1},
		SecretUI: secui,
		LoginUI:  &libkb.TestLoginUI{Username: u1.Username},
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

type ldocuiPGP struct {
	*ldocui
}

func (l *ldocuiPGP) SelectSigner(arg keybase_1.SelectSignerArg) (res keybase_1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase_1.SelectSignerAction_SIGN
	res.Signer = &keybase_1.DeviceSigner{Kind: keybase_1.DeviceSignerKind_PGP}
	return
}
