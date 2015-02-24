package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

type Doctor struct {
	user *libkb.User
	/*
		docUI    libkb.DoctorUI
		secretUI libkb.SecretUI
		logUI    libkb.LogUI
		gpgUI    libkb.GPGUI
	*/

	signingKey libkb.GenericKey
	kexServer  KexServer
	devName    string
}

/*
type DocArg struct {
	DocUI    libkb.DoctorUI
	SecretUI libkb.SecretUI
	LogUI    libkb.LogUI
	GpgUI    libkb.GPGUI
}
*/

// func NewDoctor(arg *DocArg, options ...func(*Doctor)) *Doctor {
func NewDoctor(options ...func(*Doctor)) *Doctor {
	//	d := &Doctor{docUI: arg.DocUI, secretUI: arg.SecretUI, logUI: arg.LogUI, gpgUI: arg.GpgUI}
	d := &Doctor{}
	for _, opt := range options {
		opt(d)
	}
	return d
}

func WithKexServer(s KexServer) func(r *Doctor) {
	return func(d *Doctor) {
		d.kexServer = s
	}
}

func (d *Doctor) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (d *Doctor) Name() string {
	return "Doctor"
}

func (d *Doctor) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.DoctorUIKind,
		libkb.GPGUIKind,
		libkb.SecretUIKind,
	}
}

func (d *Doctor) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewDeviceEngine(nil),
		NewDetKeyEngine(nil, nil, nil),
	}
}

func (d *Doctor) LoginCheckup(ctx *Context, u *libkb.User) error {
	d.user = u

	// This can fail, but we'll warn if it does.
	d.syncSecrets()

	if err := d.checkKeys(ctx); err != nil {
		return err
	}
	return nil
}

func (d *Doctor) syncSecrets() (err error) {
	if err = G.SecretSyncer.Load(d.user.GetUid()); err != nil {
		G.Log.Warning("Problem syncing secrets from server: %s", err)
	}
	return err
}

func (d *Doctor) checkKeys(ctx *Context) error {
	kf := d.user.GetKeyFamily()
	if kf == nil {
		return d.addBasicKeys(ctx)
	}
	if kf.GetEldest() == nil {
		return d.addBasicKeys(ctx)
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
		return d.deviceSign(ctx, hasPGP)
	}

	// they don't have any devices.

	dk, err := d.detkey(ctx)
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
			return d.deviceSign(ctx, true)
		}
		return err
	}

	// use their detkey to sign this device
	return d.addDeviceKeyWithSigner(ctx, dk, dk.GetKid())
}

// addBasicKeys is used for accounts that have no device or det
// keys.
func (d *Doctor) addBasicKeys(ctx *Context) error {
	if err := d.addDeviceKey(ctx); err != nil {
		return err
	}

	if err := d.addDetKey(ctx, d.signingKey.GetKid()); err != nil {
		return err
	}

	return nil
}

func (d *Doctor) addDeviceKey(ctx *Context) error {
	devname, err := d.deviceName(ctx)
	if err != nil {
		return err
	}
	tk, err := d.tspkey(ctx)
	if err != nil {
		return err
	}
	eng := NewDeviceEngine(d.user)
	args := DeviceEngineArgs{
		Name:          devname,
		LksClientHalf: tk.LksClientHalf(),
	}
	if err := RunEngine(eng, ctx, args, nil); err != nil {
		return err
	}

	// XXX get this from reply?
	d.signingKey = eng.EldestKey()
	return nil
}

func (d *Doctor) addDeviceKeyWithSigner(ctx *Context, signer libkb.GenericKey, eldestKID libkb.KID) error {
	devname, err := d.deviceName(ctx)
	if err != nil {
		return err
	}
	tk, err := d.tspkey(ctx)
	if err != nil {
		return err
	}
	eng := NewDeviceEngine(d.user)
	args := DeviceEngineArgs{
		Name:          devname,
		LksClientHalf: tk.LksClientHalf(),
		Signer:        signer,
		EldestKID:     eldestKID,
	}
	if err := RunEngine(eng, ctx, args, nil); err != nil {
		return err
	}

	d.signingKey = signer
	return nil
}

func (d *Doctor) addDetKey(ctx *Context, eldest libkb.KID) error {
	tk, err := d.tspkey(ctx)
	if err != nil {
		return err
	}
	eng := NewDetKeyEngine(d.user, d.signingKey, eldest)
	return RunEngine(eng, ctx, DetKeyArgs{Tsp: tk}, nil)
}

var ErrNotYetImplemented = errors.New("not yet implemented")

// deviceSign is used to sign a new installation of keybase on a
// new device.  It happens when the user has keys already, either
// a device key, pgp key, or both.
func (d *Doctor) deviceSign(ctx *Context, withPGPOption bool) error {
	devname, err := d.deviceName(ctx)
	if err != nil {
		return err
	}

	devs, err := G.SecretSyncer.ActiveDevices()
	if err != nil {
		return err
	}

	var arg keybase_1.SelectSignerArg
	for k, v := range devs {
		arg.Devices = append(arg.Devices, keybase_1.Device{Type: v.Type, Name: v.Description, DeviceID: k})
	}
	arg.HasPGP = withPGPOption

	res, err := ctx.DoctorUI.SelectSigner(arg)
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
		return d.deviceSignPGP(ctx)
	}

	if res.Signer.Kind == keybase_1.DeviceSignerKind_DEVICE {
		return d.deviceSignExistingDevice(ctx, *res.Signer.DeviceID, devname, libkb.DEVICE_TYPE_DESKTOP)
	}

	return fmt.Errorf("unknown signer kind: %d", res.Signer.Kind)
}

func (d *Doctor) deviceSignPGP(ctx *Context) error {
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

	G.Log.Info("selected pgp key: %s", selected.VerboseDescription())
	G.Log.Info("selected pgp key kid: %s", selected.GetKid())
	if pk, ok := G.SecretSyncer.FindPrivateKey(selected.GetKid().String()); ok {
		skb, err := pk.ToSKB()
		if err != nil {
			return err
		}

		pgpk, err := skb.PromptAndUnlock("pgp sign", "keybase", ctx.SecretUI)
		if err != nil {
			return err
		}
		return d.deviceSignPGPNext(ctx, pgpk)
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

	if err := bundle.Unlock("Import of key into keybase keyring", ctx.SecretUI); err != nil {
		return fmt.Errorf("bundle Unlock error: %s", err)
	}

	return d.deviceSignPGPNext(ctx, bundle)
}

func (d *Doctor) deviceSignPGPNext(ctx *Context, pgpk libkb.GenericKey) error {
	if pgpk.CanSign() == false {
		return fmt.Errorf("pgp key can't sign")
	}

	eldest := d.user.GetEldestFOKID().Kid
	G.Log.Info("eldest kid from user: %s", eldest)
	if err := d.addDeviceKeyWithSigner(ctx, pgpk, eldest); err != nil {
		return err
	}

	if err := d.addDetKey(ctx, eldest); err != nil {
		return err
	}

	return nil
}

func (d *Doctor) deviceSignExistingDevice(ctx *Context, id, devName, devType string) error {
	G.Log.Info("device sign with existing device [%s]", id)

	if d.kexServer == nil {
		return fmt.Errorf("no kex server")
	}

	// XXX move this to kex?  should it create the new device???
	src, err := libkb.NewDeviceID()
	if err != nil {
		return err
	}

	dst, err := libkb.ImportDeviceID(id)
	if err != nil {
		return err
	}

	tk, err := d.tspkey(ctx)
	if err != nil {
		return err
	}
	//	if err := eng.Run(devname, tk.LksClientHalf()); err != nil {

	k := NewKex(d.kexServer, tk.LksClientHalf())
	return k.StartForward(ctx, d.user, src, *dst, devType, devName)
}

func (d *Doctor) selectPGPKey(ctx *Context, keys []*libkb.PgpKeyBundle) (*libkb.PgpKeyBundle, error) {
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

func (d *Doctor) tspkey(ctx *Context) (libkb.PassphraseStream, error) {
	return G.LoginState.GetPassphraseStream(ctx.SecretUI)
}

func (d *Doctor) detkey(ctx *Context) (libkb.GenericKey, error) {
	// get server half of detkey via ss
	half, err := G.SecretSyncer.FindDetKeySrvHalf(libkb.KEY_TYPE_KB_NACL_EDDSA_SERVER_HALF)
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

func (d *Doctor) deviceName(ctx *Context) (string, error) {
	if len(d.devName) == 0 {
		name, err := ctx.DoctorUI.PromptDeviceName(0)
		if err != nil {
			return "", err
		}
		d.devName = name
	}
	return d.devName, nil
}
