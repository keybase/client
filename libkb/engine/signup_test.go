package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/go/libkb"
)

func AssertDeviceID() (err error) {
	if G.Env.GetDeviceID() == nil {
		err = fmt.Errorf("Device ID should not have been reset!")
	}
	return
}

func TestSignupEngine(t *testing.T) {
	tc := libkb.SetupTest(t, "signup")
	defer tc.Cleanup()
	var err error

	fu := CreateAndSignupFakeUser(t, "se")

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in
	G.LoginState.Logout()

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	fu.LoginOrBust(t)

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in w/ PublicKey Auth
	G.LoginState.Logout()

	if err := G.Session.AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}

	sui := libkb.TestSecretUI{fu.Passphrase}
	if err = G.LoginState.PubkeyLogin("", sui); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// Now try to logout to make sure we logged out OK
	G.LoginState.Logout()

	if err = AssertDeviceID(); err != nil {
		t.Fatal(err)
	}

	if err = G.Session.AssertLoggedOut(); err != nil {
		t.Fatal(err)
	}
}

func TestSignupWithGPG(t *testing.T) {
	tc := libkb.SetupTest(t, "signupWithGPG")
	defer tc.Cleanup()

	fu := NewFakeUserOrBust(t, "se")
	if err := tc.GenerateGPGKeyring(fu.Email); err != nil {
		t.Fatal(err)
	}
	secui := libkb.TestSecretUI{fu.Passphrase}
	s := NewSignupEngine(&gpgtestui{}, secui)
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", false, true}
	ctx := NewContext(G.UI.GetLogUI(), &gpgtestui{}, secui)
	if err := RunEngine(s, ctx, arg, nil); err != nil {
		t.Fatal(err)
	}
}

func TestLocalKeySecurity(t *testing.T) {
	tc := libkb.SetupTest(t, "signup")
	defer tc.Cleanup()
	s := NewSignupEngine(nil, nil)
	fu := NewFakeUserOrBust(t, "se")
	secui := libkb.TestSecretUI{fu.Passphrase}
	arg := SignupEngineRunArg{fu.Username, fu.Email, testInviteCode, fu.Passphrase, "my device", true, true}
	ctx := NewContext(G.UI.GetLogUI(), &gpgtestui{}, secui)
	if err := RunEngine(s, ctx, arg, nil); err != nil {
		t.Fatal(err)
	}

	ch := s.tspkey.LksClientHalf()

	lks := libkb.NewLKSecClientHalf(ch)
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
