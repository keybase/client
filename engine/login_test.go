package engine

import (
	"os"
	"path"
	"testing"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

func TestLogin(t *testing.T) {
	tc := libkb.SetupTest(t, "login")
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

	s := NewSignupEngine()

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
	tc := libkb.SetupTest(t, "login")
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

	//	ckf.DumpToLog(G.UI.GetLogUI())

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
	tc := libkb.SetupTest(t, "login")
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
	li := NewLoginEngine()
	secui := libkb.TestSecretUI{passphrase}
	ctx := NewContext(G.UI.GetLogUI(), &ldocui{}, &gpgtestui{}, secui, &libkb.TestLoginUI{})
	if err := RunEngine(li, ctx, larg, nil); err != nil {
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

	s := NewSignupEngine()

	if err := s.genTSPassKey(passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(username, email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	// generate the detkey only, using SelfProof
	eng := NewDetKeyEngine(s.me, nil, nil)
	ctx := NewContext(G.UI.GetLogUI())
	if err := RunEngine(eng, ctx, DetKeyArgs{Tsp: &s.tspkey, SelfProof: true}, nil); err != nil {
		t.Fatal(err)
	}

	return username, passphrase
}

func TestLoginDetKeyOnly(t *testing.T) {
	tc := libkb.SetupTest(t, "login")
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
	li := NewLoginEngine()
	secui := libkb.TestSecretUI{passphrase}
	ctx := NewContext(G.UI.GetLogUI(), &ldocui{}, secui, &gpgtestui{}, &libkb.TestLoginUI{})
	if err := RunEngine(li, ctx, larg, nil); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have a device key, login should have fixed that:
	testUserHasDeviceKey(t)
}

// synced key
func createFakeUserWithPGPOnly(t *testing.T, tc libkb.TestContext) *FakeUser {
	fu := NewFakeUserOrBust(t, "login")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}

	secui := libkb.TestSecretUI{fu.Passphrase}
	ctx := NewContext(
		&gpgtestui{},
		secui,
		G.UI.GetLogUI(),
		&libkb.TestKeyGenUI{},
		&libkb.TestLoginUI{fu.Username})
	s := NewSignupEngine()

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	if err := s.addGPG(ctx); err != nil {
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

	secui := libkb.TestSecretUI{fu.Passphrase}
	s := NewSignupEngine()
	ctx := NewContext(
		&gpgPubOnlyTestUI{},
		secui,
		G.UI.GetLogUI(),
		&libkb.TestKeyGenUI{},
		&libkb.TestLoginUI{fu.Username})

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	if err := s.addGPG(ctx); err != nil {
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

	secui := libkb.TestSecretUI{fu.Passphrase}
	s := NewSignupEngine()
	ctx := NewContext(
		&gpgtestui{},
		secui,
		G.UI.GetLogUI(),
		&libkb.TestKeyGenUI{},
		&libkb.TestLoginUI{fu.Username})

	if err := s.genTSPassKey(fu.Passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(fu.Username, fu.Email, testInviteCode, true); err != nil {
		t.Fatal(err)
	}

	if err := s.addGPG(ctx); err != nil {
		t.Fatal(err)
	}

	// hack the gpg ui to select a different key:
	// s.gpgUI = &gpgtestui{index: 1}
	ctx.AddUIs(&gpgtestui{index: 1})
	if err := s.addGPG(ctx); err != nil {
		t.Fatal(err)
	}

	// now it should have two pgp keys...

	return fu
}

func TestLoginPGPSignNewDevice(t *testing.T) {
	tc := libkb.SetupTest(t, "login")
	u1 := createFakeUserWithPGPOnly(t, tc)
	G.LoginState.Logout()
	tc.Cleanup()

	// redo SetupTest to get a new home directory...should look like a new device.
	tc2 := libkb.SetupTest(t, "login")
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

	li := NewLoginEngine()
	secui := libkb.TestSecretUI{u1.Passphrase}
	ctx := NewContext(G.UI.GetLogUI(), docui, secui, &gpgtestui{}, &libkb.TestLoginUI{})
	if err := RunEngine(li, ctx, larg, nil); err != nil {
		t.Fatal(err)
	}

	after := docui.selectSignerCount
	if after-before != 1 {
		t.Errorf("doc ui SelectSigner called %d times, expected 1", after-before)
	}

	testUserHasDeviceKey(t)
}

func TestLoginPGPPubOnlySignNewDevice(t *testing.T) {
	tc := libkb.SetupTest(t, "login")
	u1 := createFakeUserWithPGPPubOnly(t, tc)
	G.LoginState.Logout()

	// redo SetupTest to get a new home directory...should look like a new device.
	tc2 := libkb.SetupTest(t, "login")
	defer tc2.Cleanup()

	// we need the gpg keyring that's in the first homedir
	if err := os.Rename(path.Join(tc.Tp.GPGHome, "secring.gpg"), path.Join(tc2.Tp.GPGHome, "secring.gpg")); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(path.Join(tc.Tp.GPGHome, "pubring.gpg"), path.Join(tc2.Tp.GPGHome, "pubring.gpg")); err != nil {
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

	li := NewLoginEngine()
	secui := libkb.TestSecretUI{u1.Passphrase}
	ctx := NewContext(G.UI.GetLogUI(), docui, secui, &gpgtestui{}, &libkb.TestLoginUI{})
	if err := RunEngine(li, ctx, larg, nil); err != nil {
		t.Fatal(err)
	}

	after := docui.selectSignerCount
	if after-before != 1 {
		t.Errorf("doc ui SelectSigner called %d times, expected 1", after-before)
	}

	testUserHasDeviceKey(t)
}

func TestLoginPGPMultSignNewDevice(t *testing.T) {
	tc := libkb.SetupTest(t, "login")
	u1 := createFakeUserWithPGPMult(t, tc)
	G.LoginState.Logout()
	tc.Cleanup()

	// redo SetupTest to get a new home directory...should look like a new device.
	tc2 := libkb.SetupTest(t, "login")
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

	li := NewLoginEngine()
	secui := libkb.TestSecretUI{u1.Passphrase}
	ctx := NewContext(G.UI.GetLogUI(), docui, &gpgtestui{1}, secui, &libkb.TestLoginUI{u1.Username})
	if err := RunEngine(li, ctx, larg, nil); err != nil {
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
	devid := "xxxxxxxxxxxxxxxxxxxxxxxxxxx"
	res.Signer = &keybase_1.DeviceSigner{Kind: keybase_1.DeviceSignerKind_DEVICE, DeviceID: &devid}
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
