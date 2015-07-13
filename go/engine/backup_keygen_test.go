package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func TestBackupKeygen(t *testing.T) {
	tc := SetupEngineTest(t, "backup")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")

	ctx := &Context{}
	eng := NewBackupKeygen(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.Passphrase()) == 0 {
		t.Fatal("empty passphrase")
	}
	Logout(tc)

	// check for the backup key
	u, err := libkb.LoadUser(libkb.LoadUserArg{Name: fu.Username, ForceReload: true})
	if err != nil {
		t.Fatal(err)
	}
	cki := u.GetComputedKeyInfos()
	if cki == nil {
		t.Fatal("no computed key infos")
	}
	var devid keybase1.DeviceID
	for k, v := range cki.Devices {
		if v.Type == libkb.DeviceTypeBackup {
			devid = k
			break
		}
	}
	if devid.IsNil() {
		t.Fatal("no backup device found")
	}
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

	// make sure the passphrase authentication didn't change:

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
		SecretUI:    libkb.TestSecretUI{},
	}
	if err := RunEngine(leng, lctx); err != nil {
		t.Errorf("after backup key gen, login with passphrase failed: %s", err)
	}
}
