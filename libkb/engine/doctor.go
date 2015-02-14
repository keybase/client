package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

type Doctor struct {
	user       *libkb.User
	docUI      libkb.DoctorUI
	secretUI   libkb.SecretUI
	logUI      libkb.LogUI
	identifyUI libkb.IdentifyUI
	gpgUI      GPGUI

	signingKey libkb.GenericKey
}

type DocArg struct {
	DocUI      libkb.DoctorUI
	SecretUI   libkb.SecretUI
	LogUI      libkb.LogUI
	IdentifyUI libkb.IdentifyUI
	GpgUI      GPGUI
}

func NewDoctor(arg *DocArg) *Doctor {
	return &Doctor{docUI: arg.DocUI, secretUI: arg.SecretUI, logUI: arg.LogUI, identifyUI: arg.IdentifyUI, gpgUI: arg.GpgUI}
}

func (d *Doctor) LoginCheckup(u *libkb.User) error {
	d.user = u

	// This can fail, but we'll warn if it does.
	d.syncSecrets()

	if err := d.checkKeys(); err != nil {
		return err
	}
	return nil
}

func (d *Doctor) syncSecrets() (err error) {
	if err = G.SecretSyncer.Load(d.user.GetUid()); err != nil {
		G.Log.Warning("Problem syncing secrets from server: %s", err.Error())
	}
	return err
}

func (d *Doctor) checkKeys() error {
	kf := d.user.GetKeyFamily()
	if kf == nil {
		return d.addBasicKeys()
	}
	if kf.GetEldest() == nil {
		return d.addBasicKeys()
	}

	// they have at least one key

	if d.user.HasDeviceInCurrentInstall() {
		// they have a device sibkey for this device
		return nil
	}

	// make sure secretsyncer loaded
	if err := G.SecretSyncer.Load(d.user.GetUid()); err != nil {
		return err
	}

	hasPGP := len(d.user.GetActivePgpKeys(false)) > 0

	/*
		G.Log.Info("user has active pgp keys? %v", hasPGP)
		if d.user.GetComputedKeyFamily() == nil {
			G.Log.Info("user has nil ckf")
		} else {
			d.user.GetComputedKeyFamily().DumpToLog(d.logUI)
		}
	*/

	if G.SecretSyncer.HasActiveDevice() {
		// they have at least one device, just not this device...
		return d.deviceSign(hasPGP)
	}

	// they don't have any devices.

	dk, err := d.detkey()
	if err != nil {
		if _, ok := err.(libkb.NotFoundError); ok {
			// they don't have a detkey.
			//
			// they can get to this point if they sign up on the web,
			// add a pgp key.  With that situation, they have keys
			// so the check above for a nil key family doesn't apply.

			// make sure we have pgp
			if !hasPGP {
				return fmt.Errorf("unknown state:  no detkey, no pgpkey, no devices, but have some key(s).\nOne way to get here is to create a web user, create a pgp key via web but don't store private key on web.  Then login.  When issue #174 is done (fixes a bug with the user's computedkeyfamily, activepgpkeys), then that scenario should work fine.")
			}

			// deviceSign will handle the rest...
			return d.deviceSign(true)
		}
		return err
	}

	// use their detkey to sign this device
	return d.addDeviceKeyWithSigner(dk, dk.GetKid())
}

// addBasicKeys is used for accounts that have no device or det
// keys.
func (d *Doctor) addBasicKeys() error {
	if err := d.addDeviceKey(); err != nil {
		return err
	}

	if err := d.addDetKey(d.signingKey.GetKid()); err != nil {
		return err
	}

	return nil
}

func (d *Doctor) addDeviceKey() error {
	// XXX session id...what to put there?
	devname, err := d.docUI.PromptDeviceName(0)
	if err != nil {
		return err
	}
	tk, err := d.tspkey()
	if err != nil {
		return err
	}
	eng := NewDeviceEngine(d.user, d.logUI)
	if err := eng.Run(devname, tk.LksClientHalf()); err != nil {
		return err
	}

	d.signingKey = eng.EldestKey()
	return nil
}

func (d *Doctor) addDeviceKeyWithSigner(signer libkb.GenericKey, eldestKID libkb.KID) error {
	// XXX session id...what to put there?
	devname, err := d.docUI.PromptDeviceName(0)
	if err != nil {
		return err
	}
	tk, err := d.tspkey()
	if err != nil {
		return err
	}
	eng := NewDeviceEngine(d.user, d.logUI)
	if err := eng.RunWithSigner(devname, tk.LksClientHalf(), signer, eldestKID); err != nil {
		return fmt.Errorf("RunWithSigner error: %s", err)
	}

	d.signingKey = signer
	return nil
}

func (d *Doctor) addDetKey(eldest libkb.KID) error {
	tk, err := d.tspkey()
	if err != nil {
		return err
	}
	eng := NewDetKeyEngine(d.user, d.signingKey, eldest, d.logUI)
	return eng.Run(tk)
}

var ErrNotYetImplemented = errors.New("not yet implemented")

// deviceSign is used to sign a new installation of keybase on a
// new device.  It happens when the user has keys already, either
// a device key, pgp key, or both.
func (d *Doctor) deviceSign(withPGPOption bool) error {
	devs, err := G.SecretSyncer.ActiveDevices()
	if err != nil {
		return err
	}

	var arg keybase_1.SelectSignerArg
	for k, v := range devs {
		G.Log.Info("Device %s: %+v", k, v)
		arg.Devices = append(arg.Devices, keybase_1.DeviceDescription{Type: v.Type, Name: v.Description, DeviceID: k})
	}
	arg.HasPGP = withPGPOption

	res, err := d.docUI.SelectSigner(arg)
	if err != nil {
		return err
	}

	if res.Action == keybase_1.SelectSignerAction_LOGOUT {
		// XXX another way to bail besides returning an error?
		return fmt.Errorf("cancel requested by user")
	}
	if res.Action == keybase_1.SelectSignerAction_RESET_ACCOUNT {
		G.Log.Info("reset account action not yet implemented")
		return ErrNotYetImplemented
	}

	if res.Action != keybase_1.SelectSignerAction_SIGN {
		return fmt.Errorf("unknown action value: %d", res.Action)
	}

	// sign action:

	if res.Signer.Kind == keybase_1.DeviceSignerKind_PGP {
		return d.deviceSignPGP()
	}

	if res.Signer.Kind == keybase_1.DeviceSignerKind_DEVICE {
		return d.deviceSignExistingDevice(*res.Signer.DeviceID)
	}

	return fmt.Errorf("unknown signer kind: %d", res.Signer.Kind)
}

func (d *Doctor) deviceSignPGP() error {
	pgpKeys := d.user.GetActivePgpKeys(false)
	var selected *libkb.PgpKeyBundle
	if len(pgpKeys) > 1 {
		// show a list of pgp keys and let them select which one to use
		var err error
		selected, err = d.selectPGPKey(pgpKeys)
		if err != nil {
			return err
		}
		if selected == nil {
			return fmt.Errorf("no key selected")
		}
	} else {
		selected = pgpKeys[0]
	}

	G.Log.Info("selected pgp key: %s", selected.VerboseDescription())
	G.Log.Info("selected pgp key kid: %s", selected.GetKid())
	if pk, ok := G.SecretSyncer.FindPrivateKey(selected.GetKid().String()); ok {
		skb, err := pk.ToSKB()
		if err != nil {
			return err
		}

		pgpk, err := skb.PromptAndUnlock("pgp sign", "keybase", d.secretUI)
		if err != nil {
			return err
		}
		return d.deviceSignPGPNext(pgpk)
	}

	// use gpg to unlock it
	gpg := G.GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		return err
	}

	bundle, err := gpg.ImportKey(true, selected.GetFingerprint())
	if err != nil {
		return fmt.Errorf("ImportKey error: %s", err)
	}

	if err := bundle.Unlock("Import of key into keybase keyring", d.secretUI); err != nil {
		return fmt.Errorf("bundle Unlock error: %s", err)
	}

	return d.deviceSignPGPNext(bundle)
}

func (d *Doctor) deviceSignPGPNext(pgpk libkb.GenericKey) error {
	if pgpk.CanSign() == false {
		return fmt.Errorf("pgp key can't sign")
	}

	eldest := d.user.GetEldestFOKID().Kid
	G.Log.Info("eldest kid from user: %s", eldest)
	if err := d.addDeviceKeyWithSigner(pgpk, eldest); err != nil {
		return err
	}

	if err := d.addDetKey(eldest); err != nil {
		return err
	}

	return nil
}

func (d *Doctor) deviceSignExistingDevice(id string) error {
	G.Log.Info("device sign with existing device [%s]", id)
	G.Log.Info("device sign with existing device not yet implemented")
	return ErrNotYetImplemented
}

func (d *Doctor) selectPGPKey(keys []*libkb.PgpKeyBundle) (*libkb.PgpKeyBundle, error) {
	if d.gpgUI == nil {
		return nil, fmt.Errorf("nil gpg ui")
	}
	var gks []keybase_1.GPGKey
	for _, key := range keys {
		algo, kid, creation := key.KeyInfo()
		gk := keybase_1.GPGKey{
			Algorithm:  algo,
			KeyID:      kid,
			Creation:   creation,
			Identities: key.IdentityNames(),
		}
		gks = append(gks, gk)
	}

	keyid, err := d.gpgUI.SelectKey(keybase_1.SelectKeyArg{Keys: gks})
	if err != nil {
		return nil, err
	}
	G.Log.Info("SelectKey result: %+v", keyid)

	var selected *libkb.PgpKeyBundle
	for _, key := range keys {
		if key.GetFingerprint().ToKeyId() == keyid {
			selected = key
			break
		}
	}

	return selected, nil
}

func (d *Doctor) tspkey() (*libkb.TSPassKey, error) {
	t := G.LoginState.GetCachedTSPassKey()
	if t != nil {
		return t, nil
	}

	// not cached: get it from the ui
	pp, err := d.secretUI.GetKeybasePassphrase(keybase_1.GetKeybasePassphraseArg{Username: G.Env.GetUsername()})
	if err != nil {
		return nil, err
	}
	err = G.LoginState.StretchKey(pp)
	if err != nil {
		return nil, err
	}
	return G.LoginState.GetCachedTSPassKey(), nil
}

func (d *Doctor) detkey() (libkb.GenericKey, error) {
	// get server half of detkey via ss
	half, err := G.SecretSyncer.FindDetKeySrvHalf(libkb.KEY_TYPE_KB_NACL_EDDSA_SERVER_HALF)
	if err != nil {
		return nil, err
	}

	// regenerate the detkey
	tk, err := d.tspkey()
	if err != nil {
		return nil, err
	}

	detkey, err := GenSigningDetKey(tk, half)
	if err != nil {
		return nil, err
	}
	return detkey, nil
}
