package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
)

func AssertDeviceID(g *libkb.GlobalContext) (err error) {
	if g.Env.GetDeviceID().IsNil() {
		err = fmt.Errorf("Device ID should not have been reset!")
	}
	return
}

func TestSignupEngine(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	var err error

	fu := CreateAndSignupFakeUser(tc, "se")

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in
	Logout(tc)

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	fu.LoginOrBust(tc)

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	// Now try to logout and log back in w/ PublicKey Auth
	Logout(tc)

	if err := AssertLoggedOut(tc); err != nil {
		t.Fatal(err)
	}

	mockGetSecret := &GetSecretMock{
		Passphrase: fu.Passphrase,
	}
	if err = tc.G.LoginState().LoginWithPrompt(fu.Username, nil, mockGetSecret, nil); err != nil {
		t.Fatal(err)
	}

	mockGetSecret.CheckLastErr(t)

	if !mockGetSecret.Called {
		t.Errorf("secretUI.GetSecret() unexpectedly not called")
	}

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = AssertLoggedIn(tc); err != nil {
		t.Fatal(err)
	}

	// Now try to logout to make sure we logged out OK
	Logout(tc)

	if err = AssertDeviceID(tc.G); err != nil {
		t.Fatal(err)
	}

	if err = AssertLoggedOut(tc); err != nil {
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
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipGPG = false
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
	arg := MakeTestSignupEngineRunArg(fu)
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

	ch := s.ppStream.LksClientHalf()

	lks := libkb.NewLKSec(ch, s.ppStream.Generation(), s.uid, nil)
	if err := lks.Load(nil); err != nil {
		t.Fatal(err)
	}

	text := "the people on the bus go up and down, up and down, up and down"
	enc, err := lks.Encrypt([]byte(text))
	if err != nil {
		t.Fatal(err)
	}

	dec, err := lks.Decrypt(nil, enc)
	if err != nil {
		t.Fatal(err)
	}
	if string(dec) != text {
		t.Errorf("decrypt: %q, expected %q", string(dec), text)
	}
}

// Test that the signup engine stores the secret correctly when
// StoreSecret is set.
func TestLocalKeySecurityStoreSecret(t *testing.T) {
	tc := SetupEngineTest(t, "signup")
	defer tc.Cleanup()
	fu := NewFakeUserOrBust(t, "se")

	secretStore := libkb.NewSecretStore(fu.Username)
	if secretStore == nil {
		t.Skip("No SecretStore on this platform")
	}

	_, err := secretStore.RetrieveSecret()
	if err == nil {
		t.Fatal("User unexpectedly has secret")
	}

	secui := libkb.TestSecretUI{Passphrase: fu.Passphrase}
	arg := MakeTestSignupEngineRunArg(fu)
	arg.StoreSecret = true
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

	secret, err := s.lks.GetSecret()
	if err != nil {
		t.Fatal(err)
	}

	storedSecret, err := secretStore.RetrieveSecret()
	if err != nil {
		t.Error(err)
	}

	if string(secret) != string(storedSecret) {
		t.Errorf("Expected %v, got %v", secret, storedSecret)
	}

	err = secretStore.ClearSecret()
	if err != nil {
		t.Error(err)
	}
}

func TestIssue280(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	// Initialize state with user U1
	u1 := CreateAndSignupFakeUser(tc, "login")
	Logout(tc)
	u1.LoginOrBust(tc)
	Logout(tc)

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
