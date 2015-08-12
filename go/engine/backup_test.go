package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func backupDevs(t *testing.T, fu *FakeUser) (*libkb.User, []*libkb.Device) {
	u, err := libkb.LoadUser(libkb.LoadUserArg{Name: fu.Username, ForceReload: true})
	if err != nil {
		t.Fatal(err)
	}
	cki := u.GetComputedKeyInfos()
	if cki == nil {
		t.Fatal("no computed key infos")
	}
	return u, cki.BackupDevices()
}

func hasOneBackupDev(t *testing.T, fu *FakeUser) {
	u, bdevs := backupDevs(t, fu)

	if len(bdevs) != 1 {
		t.Fatalf("num backup devices: %d, expected 1", len(bdevs))
	}

	devid := bdevs[0].ID
	sibkey, err := u.GetComputedKeyFamily().GetSibkeyForDevice(devid)
	if err != nil {
		t.Fatal(err)
	}
	if sibkey == nil {
		t.Fatal("nil backup sibkey")
	}
	enckey, err := u.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(devid)
	if err != nil {
		t.Fatal(err)
	}
	if enckey == nil {
		t.Fatal("nil backup enckey")
	}
}

func TestBackup(t *testing.T) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	userDeviceID := tc.G.Env.GetDeviceID()

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := NewBackup(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}
	Logout(tc)

	// check for the backup key
	u, bdevs := backupDevs(t, fu)
	if len(bdevs) != 1 {
		t.Errorf("num backup devices: %d, expected 1", len(bdevs))
	}
	devid := bdevs[0].ID
	sibkey, err := u.GetComputedKeyFamily().GetSibkeyForDevice(devid)
	if err != nil {
		t.Fatal(err)
	}
	if sibkey == nil {
		t.Fatal("nil backup sibkey")
	}
	enckey, err := u.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(devid)
	if err != nil {
		t.Fatal(err)
	}
	if enckey == nil {
		t.Fatal("nil backup enckey")
	}

	// ok, just log in again:
	if err := fu.Login(tc.G); err != nil {
		t.Errorf("after backup key gen, login failed: %s", err)
	}
	Logout(tc)

	// make sure the passphrase authentication didn't change:
	leng := NewLoginWithPassphraseEngine(fu.Username, fu.Passphrase, false, tc.G)
	lctx := &Context{
		LogUI:       tc.G.UI.GetLogUI(),
		LocksmithUI: &lockui{},
		GPGUI:       &gpgtestui{},
		SecretUI:    &libkb.TestSecretUI{},
	}
	if err := RunEngine(leng, lctx); err != nil {
		t.Errorf("after backup key gen, login with passphrase failed: %s", err)
	}

	_, err = tc.G.LoginState().VerifyPlaintextPassphrase(fu.Passphrase)
	if err != nil {
		t.Fatal(err)
	}

	// make sure the backup key device id is different than the actual device id
	// and that the actual device id didn't change.
	// (investigating bug theory)
	if userDeviceID == devid {
		t.Errorf("user's device id before backup key gen (%s) matches backup key device id (%s).  They shouuld be different.", userDeviceID, devid)
	}
	if userDeviceID != tc.G.Env.GetDeviceID() {
		t.Errorf("user device id changed.  start = %s, post-backup = %s", userDeviceID, tc.G.Env.GetDeviceID())
	}
	if tc.G.Env.GetDeviceID() == devid {
		t.Errorf("current device id (%s) matches backup key device id (%s).  They should be different.", tc.G.Env.GetDeviceID(), devid)
	}
}

// tests revoking of existing backup keys
func TestBackupRevoke(t *testing.T) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  libkb.TestLoginUI{RevokeBackup: true},
		SecretUI: &libkb.TestSecretUI{},
	}

	eng := NewBackup(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}

	// check for the backup key
	_, bdevs := backupDevs(t, fu)
	if len(bdevs) != 1 {
		t.Errorf("num backup devices: %d, expected 1", len(bdevs))
	}

	// generate another one, first should be revoked
	eng = NewBackup(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}

	// check for the backup key
	_, bdevs = backupDevs(t, fu)
	if len(bdevs) != 1 {
		t.Errorf("num backup devices: %d, expected 1", len(bdevs))
	}
}

// tests not revoking existing backup keys
func TestBackupNoRevoke(t *testing.T) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  libkb.TestLoginUI{RevokeBackup: false},
		SecretUI: &libkb.TestSecretUI{},
	}

	eng := NewBackup(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}

	// check for the backup key
	_, bdevs := backupDevs(t, fu)
	if len(bdevs) != 1 {
		t.Errorf("num backup devices: %d, expected 1", len(bdevs))
	}

	// generate another one, first should be left alone
	eng = NewBackup(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}

	// check for the backup key
	_, bdevs = backupDevs(t, fu)
	if len(bdevs) != 2 {
		t.Errorf("num backup devices: %d, expected 2", len(bdevs))
	}
}

// Make sure BackupKeygen uses the secret store.
func TestBackupKeygenWithSecretStore(t *testing.T) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		ctx := &Context{
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  libkb.TestLoginUI{},
			SecretUI: secretUI,
		}
		eng := NewBackup(tc.G)
		if err := RunEngine(eng, ctx); err != nil {
			t.Fatal(err)
		}
	})
}
