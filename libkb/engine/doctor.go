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

	signingKey libkb.GenericKey
}

func NewDoctor(docUI libkb.DoctorUI, secUI libkb.SecretUI, logUI libkb.LogUI, identifyUI libkb.IdentifyUI) *Doctor {
	return &Doctor{docUI: docUI, secretUI: secUI, logUI: logUI, identifyUI: identifyUI}
}

func (d *Doctor) LoginCheckup(u *libkb.User) error {
	d.user = u

	// This can fail, but we'll warn if it does.
	d.syncSecrets()

	if err := d.checkUID(); err != nil {
		return err
	}

	if err := d.checkKeys(); err != nil {
		return err
	}
	return nil
}

// checkUID makes sure that we've verified our own UID.  This might result in a
// self-tracking operation.
func (d *Doctor) checkUID() (err error) {
	uid := d.user.GetUid()

	if !d.user.HasActiveKey() {
		d.logUI.Debug("Skipping checkUID due to no active key")
	} else if u2 := G.Env.GetVerifiedUID(); u2 != nil && !u2.Eq(uid) {
		err = libkb.UidMismatchError{Msg: fmt.Sprintf("Got wrong uid; wanted %s but got %s", uid, u2)}
	} else if u2 == nil && d.identifyUI != nil {
		d.logUI.Warning("Verifying your UID...")
		err = d.user.IdentifySelf(d.identifyUI)
		if err == nil {
			d.logUI.Warning("Setting UID to %s", uid)
		}
	}
	return err
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

	if G.SecretSyncer.HasActiveDevice() {
		// they have at least one device, just not this device...
		return d.deviceSign()
	}

	// they don't have any devices.  use their detkey to sign a new device.
	dk, err := d.detkey()
	if err != nil {
		return err
	}
	return d.addDeviceKeyWithDetKey(dk)
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

var ErrNotYetImplemented = errors.New("not yet implemented")

func (d *Doctor) deviceSign() error {
	devs, err := G.SecretSyncer.ActiveDevices()
	if err != nil {
		return err
	}

	var devDescs []keybase_1.DeviceDescription
	for k, v := range devs {
		G.Log.Info("Device %s: %+v", k, v)
		devDescs = append(devDescs, keybase_1.DeviceDescription{Type: v.Type, Name: v.Description})
	}

	_, err = d.docUI.SelectSigner(devDescs)
	if err != nil {
		return err
	}
	return ErrNotYetImplemented
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
