package engine

import (
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

type Locksmith struct {
	libkb.Contextified
	user       *libkb.User
	signingKey libkb.GenericKey
	devName    string
	lks        *libkb.LKSec
	kexMu      sync.Mutex
	kex        *KexFwd
}

func NewLocksmith() *Locksmith {
	return &Locksmith{}
}

func (d *Locksmith) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (d *Locksmith) Name() string {
	return "Doctor"
}

func (d *Locksmith) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.DoctorUIKind,
		libkb.GPGUIKind,
		libkb.SecretUIKind,
	}
}

func (d *Locksmith) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceWrap{},
		&DetKeyEngine{},
	}
}

func (d *Locksmith) LoginCheckup(ctx *Context, u *libkb.User) error {
	d.user = u
	d.SetGlobalContext(ctx.GlobalContext)

	// This can fail, but we'll warn if it does.
	d.syncSecrets()

	if err := d.checkKeys(ctx); err != nil {
		return err
	}
	return nil
}

func (d *Locksmith) Cancel() error {
	d.kexMu.Lock()
	defer d.kexMu.Unlock()
	if d.kex == nil {
		d.G().Log.Debug("Doctor Cancel called, but kex is nil")
		return nil
	}
	return d.kex.Cancel()
}

func (d *Locksmith) syncSecrets() (err error) {
	if err = libkb.RunSyncer(d.G().SecretSyncer, d.user.GetUid().P()); err != nil {
		d.G().Log.Warning("Problem syncing secrets from server: %s", err)
	}
	return err
}

func (d *Locksmith) checkKeys(ctx *Context) error {
	d.G().Log.Debug("+ Doctor::checkKeys()")
	defer func() {
		d.G().Log.Debug("- Doctor::checkKeys()")
	}()

	kf := d.user.GetKeyFamily()
	if kf == nil {
		d.G().Log.Debug("| User didn't have a key family")
		return d.addBasicKeys(ctx)
	}
	if kf.GetEldest() == nil {
		d.G().Log.Debug("| User didn't have an eldest key")
		return d.addBasicKeys(ctx)
	}

	// they have at least one key

	if d.user.HasDeviceInCurrentInstall() {
		// they have a device sibkey for this device
		d.G().Log.Debug("| User has a device in the current install; all done")
		return nil
	}

	// make sure secretsyncer loaded --- likely not needed since we
	// already did this about
	d.G().Log.Debug("| Syncing secrets")
	d.syncSecrets()

	hasPGP := len(d.user.GetActivePgpKeys(false)) > 0

	if d.G().SecretSyncer.HasActiveDevice() {
		// they have at least one device, just not this device...
		d.G().Log.Debug("| User has an active device, just not this one")
		return d.deviceSign(ctx, hasPGP)
	}

	// they don't have any devices.
	d.G().Log.Debug("| the user doesn't have any devices")

	dk, err := d.detkey(ctx)

	if err == nil {

		d.G().Log.Debug("| The user has a detkey")
		// use their detkey to sign this device
		err = d.addDeviceKeyWithSigner(ctx, dk, dk.GetKid())

	} else if _, ok := err.(libkb.NotFoundError); ok {

		d.G().Log.Debug("| The user doesn't have a detkey")
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
		err = d.deviceSign(ctx, true)
	} else {
		d.G().Log.Debug("| The user doesn't have a detkey")
	}

	return err
}

// addBasicKeys is used for accounts that have no device or det
// keys.
func (d *Locksmith) addBasicKeys(ctx *Context) error {
	if err := d.addDeviceKey(ctx); err != nil {
		return err
	}

	if err := d.addDetKey(ctx, d.signingKey.GetKid()); err != nil {
		return err
	}

	return nil
}

func (d *Locksmith) addDeviceKey(ctx *Context) error {
	devname, err := d.deviceName(ctx)
	if err != nil {
		return err
	}
	tk, err := d.tspkey(ctx)
	if err != nil {
		return err
	}

	d.lks = libkb.NewLKSec(tk.LksClientHalf(), d.G())
	args := &DeviceWrapArgs{
		Me:         d.user,
		DeviceName: devname,
		Lks:        d.lks,
		IsEldest:   true,
	}
	eng := NewDeviceWrap(args)
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	d.signingKey = eng.SigningKey()

	return nil
}

func (d *Locksmith) addDeviceKeyWithSigner(ctx *Context, signer libkb.GenericKey, eldestKID libkb.KID) error {
	devname, err := d.deviceName(ctx)
	if err != nil {
		return err
	}
	tk, err := d.tspkey(ctx)
	if err != nil {
		return err
	}
	d.lks = libkb.NewLKSec(tk.LksClientHalf(), d.G())
	args := &DeviceWrapArgs{
		Me:         d.user,
		DeviceName: devname,
		Lks:        d.lks,
		IsEldest:   false,
		Signer:     signer,
		EldestKID:  eldestKID,
	}
	eng := NewDeviceWrap(args)
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	d.signingKey = eng.SigningKey()
	return nil
}

func (d *Locksmith) addDetKey(ctx *Context, eldest libkb.KID) error {
	if d.signingKey == nil {
		return fmt.Errorf("addDetKey called, but d.signingKey is nil")
	}
	tk, err := d.tspkey(ctx)
	if err != nil {
		return err
	}
	arg := &DetKeyArgs{
		Tsp:         tk,
		Me:          d.user,
		SigningKey:  d.signingKey,
		EldestKeyID: eldest,
	}
	eng := NewDetKeyEngine(arg)
	return RunEngine(eng, ctx)
}

var ErrNotYetImplemented = errors.New("not yet implemented")

// deviceSign is used to sign a new installation of keybase on a
// new device.  It happens when the user has keys already, either
// a device key, pgp key, or both.
func (d *Locksmith) deviceSign(ctx *Context, withPGPOption bool) error {
	newDeviceName, err := d.deviceName(ctx)
	if err != nil {
		return err
	}

	devs, err := d.G().SecretSyncer.ActiveDevices()
	if err != nil {
		return err
	}

	var arg keybase_1.SelectSignerArg
	for k, v := range devs {
		if v.Type != libkb.DEVICE_TYPE_WEB {
			arg.Devices = append(arg.Devices, keybase_1.Device{Type: v.Type, Name: v.Description, DeviceID: k})
		}
	}
	arg.HasPGP = withPGPOption

	res, err := ctx.LocksmithUI.SelectSigner(arg)
	if err != nil {
		return err
	}

	if res.Action == keybase_1.SelectSignerAction_CANCEL {
		// XXX another way to bail besides returning an error?
		return fmt.Errorf("cancel requested by user")
	}
	if res.Action == keybase_1.SelectSignerAction_RESET_ACCOUNT {
		d.G().Log.Info("reset account action not yet implemented")
		return ErrNotYetImplemented
	}

	if res.Action != keybase_1.SelectSignerAction_SIGN {
		return fmt.Errorf("unknown action value: %d", res.Action)
	}

	// sign action:

	if res.Signer.Kind == keybase_1.DeviceSignerKind_PGP {
		return d.deviceSignPGP(ctx)
	}

	if res.Signer.Kind == keybase_1.DeviceSignerKind_DEVICE {
		return d.deviceSignExistingDevice(ctx, *res.Signer.DeviceID, *res.Signer.DeviceName, newDeviceName, libkb.DEVICE_TYPE_DESKTOP)
	}

	return fmt.Errorf("unknown signer kind: %d", res.Signer.Kind)
}

func (d *Locksmith) deviceSignPGP(ctx *Context) error {
	pgpKeys := d.user.GetActivePgpKeys(false)
	var selected *libkb.PgpKeyBundle
	if len(pgpKeys) > 1 {
		// show a list of pgp keys and let them select which one to use
		var err error
		selected, err = d.selectPGPKey(ctx, pgpKeys)
		if err != nil {
			return err
		}
		if selected == nil {
			return fmt.Errorf("no key selected")
		}
	} else {
		selected = pgpKeys[0]
	}

	d.G().Log.Info("selected pgp key: %s", selected.VerboseDescription())
	d.G().Log.Info("selected pgp key kid: %s", selected.GetKid())
	if pk, ok := d.G().SecretSyncer.FindPrivateKey(selected.GetKid().String()); ok {
		skb, err := pk.ToSKB()
		if err != nil {
			return err
		}

		pgpk, err := skb.PromptAndUnlock("pgp sign", "keybase", nil, ctx.SecretUI)
		if err != nil {
			return err
		}
		return d.deviceSignPGPNext(ctx, pgpk)
	}

	// use gpg to unlock it
	gpg := d.G().GetGpgClient()
	if _, err := gpg.Configure(); err != nil {
		return err
	}

	bundle, err := gpg.ImportKey(true, selected.GetFingerprint())
	if err != nil {
		return fmt.Errorf("ImportKey error: %s", err)
	}

	if err := bundle.Unlock("Import of key into keybase keyring", ctx.SecretUI); err != nil {
		return fmt.Errorf("bundle Unlock error: %s", err)
	}

	return d.deviceSignPGPNext(ctx, bundle)
}

func (d *Locksmith) deviceSignPGPNext(ctx *Context, pgpk libkb.GenericKey) error {
	if pgpk.CanSign() == false {
		return fmt.Errorf("pgp key can't sign")
	}

	eldest := d.user.GetEldestFOKID().Kid
	d.G().Log.Info("eldest kid from user: %s", eldest)
	if err := d.addDeviceKeyWithSigner(ctx, pgpk, eldest); err != nil {
		return err
	}

	dk, err := d.detkey(ctx)
	if err != nil || dk == nil {
		G.Log.Debug("no detkey found, adding one")
		if err := d.addDetKey(ctx, eldest); err != nil {
			return err
		}
	}

	return nil
}

func (d *Locksmith) deviceSignExistingDevice(ctx *Context, existingID, existingName, newDevName, newDevType string) error {
	d.G().Log.Info("device sign with existing device [%s]", existingID)
	d.G().Log.Debug("new device name: %s", newDevName)

	dst, err := libkb.ImportDeviceID(existingID)
	if err != nil {
		return err
	}

	tk, err := d.tspkey(ctx)
	if err != nil {
		return err
	}

	kargs := &KexFwdArgs{
		User:    d.user,
		Dst:     *dst,
		DstName: existingName,
		DevType: newDevType,
		DevDesc: newDevName,
	}

	d.kexMu.Lock()
	d.kex = NewKexFwd(tk.LksClientHalf(), kargs, d.G())
	d.kexMu.Unlock()

	err = RunEngine(d.kex, ctx)

	d.kexMu.Lock()
	d.kex = nil
	d.kexMu.Unlock()

	return err
}

func (d *Locksmith) selectPGPKey(ctx *Context, keys []*libkb.PgpKeyBundle) (*libkb.PgpKeyBundle, error) {
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

	keyid, err := ctx.GPGUI.SelectKey(keybase_1.SelectKeyArg{Keys: gks})
	if err != nil {
		return nil, err
	}
	d.G().Log.Info("SelectKey result: %+v", keyid)

	var selected *libkb.PgpKeyBundle
	for _, key := range keys {
		if key.GetFingerprint().ToKeyId() == keyid {
			selected = key
			break
		}
	}

	return selected, nil
}

func (d *Locksmith) tspkey(ctx *Context) (libkb.PassphraseStream, error) {
	return d.G().LoginState.GetPassphraseStream(ctx.SecretUI)
}

func (d *Locksmith) detkey(ctx *Context) (libkb.GenericKey, error) {
	// get server half of detkey via ss
	half, err := d.G().SecretSyncer.FindDetKeySrvHalf(libkb.KEY_TYPE_KB_NACL_EDDSA_SERVER_HALF)
	if err != nil {
		return nil, err
	}

	// regenerate the detkey
	tk, err := d.tspkey(ctx)
	if err != nil {
		return nil, err
	}

	detkey, err := GenSigningDetKey(tk, half)
	if err != nil {
		return nil, err
	}
	return detkey, nil
}

func (d *Locksmith) deviceName(ctx *Context) (string, error) {
	if len(d.devName) == 0 {
		name, err := ctx.LocksmithUI.PromptDeviceName(0)
		if err != nil {
			return "", err
		}
		d.devName = name
	}
	return d.devName, nil
}
