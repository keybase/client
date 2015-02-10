package engine

import "github.com/keybase/go/libkb"

type Doctor struct {
	user  *libkb.User
	docUI libkb.DoctorUI
	logUI libkb.LogUI

	signingKey libkb.GenericKey
}

func NewDoctor(docUI libkb.DoctorUI, logUI libkb.LogUI) *Doctor {
	return &Doctor{docUI: docUI, logUI: logUI}
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
		G.Log.Info("eldest key: %+v", eldest)
	} else {
		G.Log.Info("IsDetKey error: %s", err)
	}

	// make a device key for them:
	return d.addDeviceKeyWithDetKey()
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
	eng := NewDeviceEngine(d.user, d.logUI)
	if err := eng.Run(devname, d.tspkey().LksClientHalf()); err != nil {
		return err
	}

	d.signingKey = eng.EldestKey()
	return nil
}

func (d *Doctor) addDeviceKeyWithDetKey() error {
	// XXX session id...what to put there?
	devname, err := d.docUI.PromptDeviceName(0)
	if err != nil {
		return err
	}
	eng := NewDeviceEngine(d.user, d.logUI)
	if err := eng.RunWithDetKey(devname, d.tspkey().LksClientHalf(), nil); err != nil {
		return err
	}

	d.signingKey = eng.EldestKey()
	return nil
}

func (d *Doctor) addDetKey() error {
	eng := NewDetKeyEngine(d.user, d.signingKey, d.logUI)
	return eng.Run(d.tspkey())
}

func (d *Doctor) tspkey() *libkb.TSPassKey {
	// XXX if this doesn't exist, perhaps should use the secret ui to get the passphrase?
	return G.LoginState.GetCachedTSPassKey()
}
