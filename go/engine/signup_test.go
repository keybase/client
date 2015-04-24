package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func AssertDeviceID() (err error) {
	if G.Env.GetDeviceID() == nil {
		err = fmt.Errorf("Device ID should not have been reset!")
	}
	return
}

func TestSignupEngine(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	fu := CreateAndSignupFakeUser(t, "se")

	if err = G.LoginState().AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in
	G.Logout()

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	fu.LoginOrBust(t)

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.LoginState().AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in w/ PublicKey Auth
	G.Logout()

	// Clear out the key stored in the keyring.
	if err := G.ConfigureKeyring(); err != nil {
		t.Error(err)
	}

	if err := G.LoginState().AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}

	mockGetSecret := &GetSecretMock{
		Passphrase: fu.Passphrase,
		T:          t,
	}
	if err = G.LoginState().LoginWithPrompt(fu.Username, nil, mockGetSecret); err != nil {
		t.Fatal(err)
	}

	if !mockGetSecret.Called {
		t.Errorf("secretUI.GetSecret() unexpectedly not called")
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.LoginState().AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout to make sure we logged out OK
	G.Logout()

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.LoginState().AssertLoggedOut(); err != nil {
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
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", false, true, nil}
	s := NewSignupEngine(&arg)
	ctx := &Context{
		LogUI:    G.UI.GetLogUI(),
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
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", true, true, nil}
	s := NewSignupEngine(&arg)
	ctx := &Context{
		LogUI:    G.UI.GetLogUI(),
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
	u1 := CreateAndSignupFakeUser(t, "login")
	G.Logout()
	u1.LoginOrBust(t)
	G.Logout()

	// Now try to sign in as user U2, and do something
	// that needs access to a locked local secret key.
	// Delegating to a new PGP key seems good enough.
	u2 := CreateAndSignupFakeUser(t, "login")

	secui := u2.NewSecretUI()
	arg := PGPKeyImportEngineArg{
		Gen: &libkb.PGPGenArg{
			PrimaryBits: 768,
			SubkeyBits:  768,
		},
	}
	arg.Gen.MakeAllIds()
	ctx := Context{
		LogUI:    G.UI.GetLogUI(),
		SecretUI: secui,
	}
	eng := NewPGPKeyImportEngine(arg)
	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal(err)
	}

	return
}
