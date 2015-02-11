package engine

import (
	"fmt"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

type Doctor struct {
	user     *libkb.User
	docUI    libkb.DoctorUI
	secretUI libkb.SecretUI
	logUI    libkb.LogUI

	signingKey libkb.GenericKey
}

func NewDoctor(docUI libkb.DoctorUI, secUI libkb.SecretUI, logUI libkb.LogUI) *Doctor {
	return &Doctor{docUI: docUI, secretUI: secUI, logUI: logUI}
}

func (d *Doctor) LoginCheckup(u *libkb.User) error {
	d.user = u
	if err := d.checkKeys(); err != nil {
		return err
	}
	return nil
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

	dkey, err := d.user.GetDeviceSibkey()
	if err == nil && dkey != nil {
		// they have a device sibkey for this device
		return nil
	}

	// for informational purposes only:
	eldest := kf.FindKey(kf.GetEldest().Kid)
	isDet, err := d.user.GetComputedKeyFamily().IsDetKey(eldest)
	if err == nil {
		G.Log.Info("eldest key is a detkey? %v", isDet)
		G.Log.Info("eldest key: %s", eldest.VerboseDescription())
	} else {
		G.Log.Info("IsDetKey error: %s", err)
	}

	// XXX eldest should be a detkey, but the stuff above is failing...

	// XXX also, eldest/detkey doesn't have private key.
	// for now, let's just make a detkey in memory for this purpose...

	// XXX need the serverHalf to reconstruct it...

	err = G.SecretSyncer.Load(d.user.GetUid())
	if err != nil {
		return err
	}
	half, err := G.SecretSyncer.FindDetKeySrvHalf(libkb.KEY_TYPE_KB_NACL_EDDSA_SERVER_HALF)
	if err != nil {
		return err
	}

	tk, err := d.tspkey()
	if err != nil {
		return err
	}
	detkey, err := GenSigningDetKey(tk, half)
	if err != nil {
		return err
	}

	// make a device key for them:
	return d.addDeviceKeyWithDetKey(detkey)
}

// addBasicKeys is used for accounts that have no device or det
// keys.
func (d *Doctor) addBasicKeys() error {
	if err := d.addDeviceKey(); err != nil {
		return err
	}

	if err := d.addDetKey(); err != nil {
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

func (d *Doctor) addDeviceKeyWithDetKey(eldest libkb.GenericKey) error {
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
	if err := eng.RunWithDetKey(devname, tk.LksClientHalf(), eldest); err != nil {
		return fmt.Errorf("RunWithDetKey error: %s", err)
	}

	d.signingKey = eng.EldestKey()
	return nil
}

func (d *Doctor) addDetKey() error {
	tk, err := d.tspkey()
	if err != nil {
		return err
	}
	eng := NewDetKeyEngine(d.user, d.signingKey, d.logUI)
	return eng.Run(tk)
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
