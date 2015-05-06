package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func AssertDeviceID(g *libkb.GlobalContext) (err error) {
	if g.Env.GetDeviceID() == nil {
		err = fmt.Errorf("Device ID should not have been reset!")
	}
	return
}

func TestSignupEngine(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	fu := CreateAndSignupFakeUser(tc, "se")

	if err = tc.G.LoginState().AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in
	tc.G.Logout()

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	fu.LoginOrBust(tc)

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = tc.G.LoginState().AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in w/ PublicKey Auth
	tc.G.Logout()

	// Clear out the key stored in the keyring.
	if err := tc.G.ConfigureKeyring(); err != nil {
		t.Error(err)
	}

	if err := tc.G.LoginState().AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}

	mockGetSecret := &GetSecretMock{
		Passphrase: fu.Passphrase,
	}
	if err = tc.G.LoginState().LoginWithPrompt(fu.Username, nil, mockGetSecret); err != nil {
		t.Fatal(err)
	}

	mockGetSecret.CheckLastErr(t)

	if !mockGetSecret.Called {
		t.Errorf("secretUI.GetSecret() unexpectedly not called")
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = tc.G.LoginState().AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout to make sure we logged out OK
	tc.G.Logout()

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = tc.G.LoginState().AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}
}

func TestSignupWithGPG(t *testing.T) {
	tc := SetupEngineTest(t, "signupWithGPG")
	defer tc.Cleanup()

	fu := NewFakeUserOrBust(t, "se")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}
	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", false, true}
	s := NewSignupEngine(&arg, tc.G)
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	if err := RunEngine(s, ctx); err != nil {
		t.Fatal(err)
	}
}

func TestLocalKeySecurity(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	fu := NewFakeUserOrBust(t, "se")
	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", true, true}
	s := NewSignupEngine(&arg, tc.G)
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: secui,
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
	}
	if err := RunEngine(s, ctx); err != nil {
		t.Fatal(err)
	}

	ch := s.tspkey.LksClientHalf()

	lks := libkb.NewLKSec(ch, nil)
	if err := lks.Load(); err != nil {
		t.Fatal(err)
	}

	text := "the people on the bus go up and down, up and down, up and down"
	enc, err := lks.Encrypt([]byte(text))
	if err != nil {
		t.Fatal(err)
	}

	dec, err := lks.Decrypt(enc)
	if err != nil {
		t.Fatal(err)
	}
	if string(dec) != text {
		t.Errorf("decrypt: %q, expected %q", string(dec), text)
	}
}

func TestIssue280(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	// Initialize state with user U1
	u1 := CreateAndSignupFakeUser(tc, "login")
	tc.G.Logout()
	u1.LoginOrBust(tc)
	tc.G.Logout()

	// Now try to sign in as user U2, and do something
	// that needs access to a locked local secret key.
	// Delegating to a new PGP key seems good enough.
	u2 := CreateAndSignupFakeUser(tc, "login")

	secui := u2.NewSecretUI()
	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: secui,
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}

	return
}
