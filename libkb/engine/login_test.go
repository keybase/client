package engine

import (
	"testing"

	"github.com/keybase/go/libkb"
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

func TestLogin2(t *testing.T) {
	tc := libkb.SetupTest(t, "login", false)
	defer tc.Cleanup()
	username, passphrase := createFakeUser(t, "my device")

	// Now try to logout and log back in
	G.LoginState.Logout()

	larg := LoginAndIdentifyArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
		LogUI: G.UI.GetLogUI(),
	}
	li := NewLoginEngine()
	if err := li.LoginAndIdentify(larg); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}
}

func createFakeUserWithNoKeys(t *testing.T) (username, passphrase string) {
	username, email := fakeUser(t, "login")
	passphrase = fakePassphrase(t)

	s := NewSignupEngine(G.UI.GetLogUI(), nil, nil)

	// going to just run the join step of signup engine
	if err := s.genTSPassKey(passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(username, email, "202020202020202020202020"); err != nil {
		t.Fatal(err)
	}

	return username, passphrase
}

func TestLoginFakeUserNoKeys(t *testing.T) {
	tc := libkb.SetupTest(t, "login", false)
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

func TestLoginAddsKeys(t *testing.T) {
	tc := libkb.SetupTest(t, "login", false)
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(t)

	G.LoginState.Logout()

	larg := LoginAndIdentifyArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
		LogUI:    G.UI.GetLogUI(),
		DoctorUI: &ldocui{},
	}
	li := NewLoginEngine()
	if err := li.LoginAndIdentify(larg); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
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

	ckf.DumpToLog(G.UI.GetLogUI())

	active := ckf.HasActiveKey()
	if !active {
		t.Errorf("user has no active key")
	}

	// XXX hold off on this, max could be fixing a bug related to this:
	dsk, err := me.GetDeviceSibkey()
	if err != nil {
		t.Fatal(err)
	}
	if dsk == nil {
		t.Fatal("nil sibkey")
	}
}

type ldocui struct{}

func (l *ldocui) PromptDeviceName(sid int) (string, error) {
	return "my test device", nil
}

func TestLogin2(t *testing.T) {
	tc := libkb.SetupTest(t, "login", false)
	defer tc.Cleanup()
	username, passphrase := createFakeUser(t, "my device")

	// Now try to logout and log back in
	G.LoginState.Logout()

	larg := LoginAndIdentifyArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
		LogUI: G.UI.GetLogUI(),
	}
	li := NewLoginEngine()
	if err := li.LoginAndIdentify(larg); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}
}

func createFakeUserWithNoKeys(t *testing.T) (username, passphrase string) {
	username, email := fakeUser(t, "login")
	passphrase = fakePassphrase(t)

	s := NewSignupEngine(G.UI.GetLogUI(), nil, nil)

	// going to just run the join step of signup engine
	if err := s.genTSPassKey(passphrase); err != nil {
		t.Fatal(err)
	}

	if err := s.join(username, email, "202020202020202020202020"); err != nil {
		t.Fatal(err)
	}

	return username, passphrase
}

func TestLoginFakeUserNoKeys(t *testing.T) {
	tc := libkb.SetupTest(t, "login", false)
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

func TestLoginAddsKeys(t *testing.T) {
	tc := libkb.SetupTest(t, "login", false)
	defer tc.Cleanup()

	username, passphrase := createFakeUserWithNoKeys(t)

	G.LoginState.Logout()

	larg := LoginAndIdentifyArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   username,
			Passphrase: passphrase,
			NoUi:       true,
		},
		LogUI:    G.UI.GetLogUI(),
		DoctorUI: &ldocui{},
	}
	li := NewLoginEngine()
	if err := li.LoginAndIdentify(larg); err != nil {
		t.Fatal(err)
	}
	if err := G.Session.AssertLoggedIn(); err != nil {
		t.Fatal(err)
	}

	// since this user didn't have any keys, login should have fixed that:
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

	ckf.DumpToLog(G.UI.GetLogUI())

	active := ckf.HasActiveKey()
	if !active {
		t.Errorf("user has no active key")
	}

	// XXX hold off on this, max could be fixing a bug related to this:
	/*
		dsk, err := me.GetDeviceSibkey()
		if err != nil {
			t.Fatal(err)
		}
		if dsk == nil {
			t.Fatal("nil sibkey")
		}
	*/
}

type ldocui struct{}

func (l *ldocui) PromptDeviceName(sid int) (string, error) {
	return "my test device", nil
}
