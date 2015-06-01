package engine

import (
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type Locksmith struct {
	libkb.Contextified
	arg *LocksmithArg

	status     LocksmithStatus
	user       *libkb.User
	signingKey libkb.GenericKey
	devName    string
	lks        *libkb.LKSec
	kexMu      sync.Mutex
	kex        *KexFwd
}

type LocksmithArg struct {
	User      *libkb.User
	CheckOnly bool
}

type LocksmithStatus struct {
	CurrentDeviceOk  bool
	NoKeys           bool
	HavePGP          bool
	HaveActiveDevice bool
	HaveDetKey       bool
}

func NewLocksmith(arg *LocksmithArg, g *libkb.GlobalContext) *Locksmith {
	return &Locksmith{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (d *Locksmith) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (d *Locksmith) Name() string {
	return "Locksmith"
}

func (d *Locksmith) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.LocksmithUIKind,
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

func (d *Locksmith) Run(ctx *Context) error {
	// This can fail, but we'll warn if it does.
	d.syncSecrets(ctx)

	// check the user, fill in d.status
	if err := d.check(ctx); err != nil {
		return err
	}
	if d.arg.CheckOnly {
		return nil
	}

	// fix the user if necessary
	return d.fix(ctx)
}

func (d *Locksmith) Status() LocksmithStatus {
	return d.status
}

func (d *Locksmith) check(ctx *Context) error {
	d.status.NoKeys = !d.hasKeyFamily()
	d.status.CurrentDeviceOk = d.arg.User.HasDeviceInCurrentInstall()
	d.status.HavePGP = d.hasPGP()
	d.status.HaveDetKey = d.hasDetKey(ctx)
	d.status.HaveActiveDevice = d.hasActiveDevice(ctx)
	return nil
}

func (d *Locksmith) hasKeyFamily() bool {
	kf := d.arg.User.GetKeyFamily()
	if kf == nil {
		return false
	}
	if d.arg.User.GetEldestFOKID() == nil {
		return false
	}
	return true
}

func (d *Locksmith) hasPGP() bool {
	return len(d.arg.User.GetActivePgpKeys(false)) > 0
}

func (d *Locksmith) fix(ctx *Context) error {
	return nil
}

func (d *Locksmith) LoginCheckup(ctx *Context, u *libkb.User) error {
	d.user = u

	// This can fail, but we'll warn if it does.
	d.syncSecrets(ctx)

	if err := d.checkKeys(ctx); err != nil {
		return err
	}
	return nil
}

func (d *Locksmith) Cancel() error {
	d.kexMu.Lock()
	defer d.kexMu.Unlock()
	if d.kex == nil {
		d.G().Log.Debug("Locksmith Cancel called, but kex is nil")
		return nil
	}
	return d.kex.Cancel()
}

func (d *Locksmith) syncSecrets(ctx *Context) (err error) {
	if ctx.LoginContext != nil {
		if err = ctx.LoginContext.RunSecretSyncer(d.arg.User.GetUID()); err != nil {
			d.G().Log.Warning("Problem syncing secrets from server: %s", err)
		}

	} else {
		if err = d.G().LoginState().RunSecretSyncer(d.arg.User.GetUID()); err != nil {
			d.G().Log.Warning("Problem syncing secrets from server: %s", err)
		}
	}
	return err
}

func (d *Locksmith) checkKeys(ctx *Context) error {
	d.G().Log.Debug("+ Locksmith::checkKeys()")
	defer func() {
		d.G().Log.Debug("- Locksmith::checkKeys()")
	}()

	kf := d.user.GetKeyFamily()
	if kf == nil {
		d.G().Log.Debug("| User didn't have a key family")
		return d.addBasicKeys(ctx)
	}
	if d.user.GetEldestFOKID() == nil {
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
	// already did this above
	d.G().Log.Debug("| Syncing secrets")
	d.syncSecrets(ctx)

	hasPGP := len(d.user.GetActivePgpKeys(false)) > 0

	if d.hasActiveDevice(ctx) {
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
			return fmt.Errorf("unknown state:  no detkey, no pgpkey, no devices, but have some key(s).\nOne way to get here is to create a web user, create a pgp key via web but don't store private key on web.  Then login.  When issue #174 is done (fixes a bug with the user's computedkeyfamily, activepgpkeys), then that scenario should work fine")
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

	d.lks = libkb.NewLKSec(tk.LksClientHalf(), d.user.GetUID(), d.G())
	args := &DeviceWrapArgs{
		Me:         d.user,
		DeviceName: devname,
		Lks:        d.lks,
		IsEldest:   true,
	}
	eng := NewDeviceWrap(args, d.G())
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
	d.lks = libkb.NewLKSec(tk.LksClientHalf(), d.user.GetUID(), d.G())
	args := &DeviceWrapArgs{
		Me:         d.user,
		DeviceName: devname,
		Lks:        d.lks,
		IsEldest:   false,
		Signer:     signer,
		EldestKID:  eldestKID,
	}
	eng := NewDeviceWrap(args, d.G())
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
	eng := NewDetKeyEngine(arg, d.G())
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

	var devs libkb.DeviceKeyMap
	if ctx.LoginContext != nil {
		devs, err = ctx.LoginContext.SecretSyncer().ActiveDevices()
	} else {
		d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
			devs, err = ss.ActiveDevices()
		}, "Locksmith - deviceSign - ActiveDevices")
	}
	if err != nil {
		return err
	}

	var arg keybase1.SelectSignerArg
	for k, v := range devs {
		if v.Type != libkb.DEVICE_TYPE_WEB {
			arg.Devices = append(arg.Devices, keybase1.Device{Type: v.Type, Name: v.Description, DeviceID: k})
		}
	}
	arg.HasPGP = withPGPOption

	totalTries := 10
	for i := 0; i < totalTries; i++ {
		if i > 0 {
			ctx.LogUI.Debug("retrying device sign process")
		}
		res, err := ctx.LocksmithUI.SelectSigner(arg)
		if err != nil {
			return err
		}

		if res.Action == keybase1.SelectSignerAction_CANCEL {
			// XXX another way to bail besides returning an error?
			return fmt.Errorf("cancel requested by user")
		}
		if res.Action == keybase1.SelectSignerAction_RESET_ACCOUNT {
			ctx.LogUI.Info("reset account action not yet implemented")
			return ErrNotYetImplemented
		}

		if res.Action != keybase1.SelectSignerAction_SIGN {
			return fmt.Errorf("unknown action value: %d", res.Action)
		}

		// sign action:

		if res.Signer.Kind == keybase1.DeviceSignerKind_PGP {
			err := d.deviceSignPGP(ctx)
			if err == nil {
				ctx.LogUI.Debug("device sign w/ pgp success")
				return nil
			}
			ctx.LogUI.Info("deviceSignPGP error: %s", err)
			uiarg := keybase1.DeviceSignAttemptErrArg{
				Msg:     err.Error(),
				Attempt: i + 1,
				Total:   totalTries,
			}
			ctx.LocksmithUI.DeviceSignAttemptErr(uiarg)
		} else if res.Signer.Kind == keybase1.DeviceSignerKind_DEVICE {
			if res.Signer.DeviceID == nil {
				return fmt.Errorf("selected device for signing, but DeviceID is nil")
			}
			if res.Signer.DeviceName == nil {
				return fmt.Errorf("selected device for signing, but DeviceName is nil")
			}
			err := d.deviceSignExistingDevice(ctx, *res.Signer.DeviceID, *res.Signer.DeviceName, newDeviceName, libkb.DEVICE_TYPE_DESKTOP)
			if err == nil {
				ctx.LogUI.Debug("device sign w/ existing device succes")
				return nil
			}
			ctx.LogUI.Info("deviceSignExistingDevice error: %s", err)
			uiarg := keybase1.DeviceSignAttemptErrArg{
				Msg:     err.Error(),
				Attempt: i + 1,
				Total:   totalTries,
			}
			ctx.LocksmithUI.DeviceSignAttemptErr(uiarg)
		} else {
			return fmt.Errorf("unknown signer kind: %d", res.Signer.Kind)
		}
	}

	return fmt.Errorf("device sign process retry attempts exhausted")
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

	ctx.LogUI.Debug("selected pgp key: %s", selected.VerboseDescription())
	ctx.LogUI.Debug("selected pgp key kid: %s", selected.GetKid())

	var pk libkb.ServerPrivateKey
	var ok bool
	if ctx.LoginContext != nil {
		pk, ok = ctx.LoginContext.SecretSyncer().FindPrivateKey(selected.GetKid().String())
	} else {
		d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
			pk, ok = ss.FindPrivateKey(selected.GetKid().String())
		}, "Locksmith - deviceSignPGP - FindPrivateKey")
	}
	if ok {
		skb, err := pk.ToSKB()
		if err != nil {
			return err
		}

		pgpk, err := skb.PromptAndUnlock(ctx.LoginContext, "pgp sign", "keybase", nil, ctx.SecretUI, nil)
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
	ctx.LogUI.Debug("eldest kid from user: %s", eldest)
	if err := d.addDeviceKeyWithSigner(ctx, pgpk, eldest); err != nil {
		return err
	}

	dk, err := d.detkey(ctx)
	if err != nil || dk == nil {
		ctx.LogUI.Debug("no detkey found, adding one")
		if err := d.addDetKey(ctx, eldest); err != nil {
			return err
		}
	}

	return nil
}

func (d *Locksmith) deviceSignExistingDevice(ctx *Context, existingID, existingName, newDevName, newDevType string) error {
	ctx.LogUI.Debug("device sign with existing device [%s]", existingID)
	ctx.LogUI.Debug("new device name: %s", newDevName)

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
	var gks []keybase1.GPGKey
	for _, key := range keys {
		algo, kid, creation := key.KeyInfo()
		gk := keybase1.GPGKey{
			Algorithm:  algo,
			KeyID:      kid,
			Creation:   creation,
			Identities: key.IdentityNames(),
		}
		gks = append(gks, gk)
	}

	keyid, err := ctx.GPGUI.SelectKey(keybase1.SelectKeyArg{Keys: gks})
	if err != nil {
		return nil, err
	}
	ctx.LogUI.Debug("SelectKey result: %+v", keyid)

	var selected *libkb.PgpKeyBundle
	for _, key := range keys {
		if key.GetFingerprint().ToKeyId() == keyid {
			selected = key
			break
		}
	}

	return selected, nil
}

func (d *Locksmith) tspkey(ctx *Context) (ret libkb.PassphraseStream, err error) {
	if ctx.LoginContext != nil {
		cached := ctx.LoginContext.PassphraseStreamCache()
		if cached == nil {
			return ret, errors.New("nil PassphraseStreamCache")
		}
		return cached.PassphraseStream(), nil
	}

	return d.G().LoginState().GetPassphraseStream(ctx.SecretUI)
}

func (d *Locksmith) detKeySrvHalf(ctx *Context) ([]byte, error) {
	var half []byte
	var err error
	if ctx.LoginContext != nil {
		half, err = ctx.LoginContext.SecretSyncer().FindDetKeySrvHalf(libkb.KEY_TYPE_KB_NACL_EDDSA_SERVER_HALF)
	} else {
		d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
			half, err = ss.FindDetKeySrvHalf(libkb.KEY_TYPE_KB_NACL_EDDSA_SERVER_HALF)
		}, "Locksmith - detKeySrvHalf")
	}
	return half, err
}

func (d *Locksmith) hasDetKey(ctx *Context) bool {
	half, err := d.detKeySrvHalf(ctx)
	if err != nil {
		return false
	}
	if len(half) == 0 {
		return false
	}
	return true
}

func (d *Locksmith) detkey(ctx *Context) (libkb.GenericKey, error) {
	// get server half of detkey via ss
	half, err := d.detKeySrvHalf(ctx)
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

func (d *Locksmith) hasActiveDevice(ctx *Context) bool {
	var res bool
	if ctx.LoginContext != nil {
		res = ctx.LoginContext.SecretSyncer().HasActiveDevice()
	} else {
		d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
			res = ss.HasActiveDevice()
		}, "Locksmith - hasActiveDevice")
	}
	return res
}
