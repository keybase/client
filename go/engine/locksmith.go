package engine

import (
	"errors"
	"fmt"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase1 "github.com/keybase/client/go/protocol"
)

type Locksmith struct {
	libkb.Contextified
	arg *LocksmithArg

	status            LocksmithStatus
	signingKey        libkb.GenericKey
	devName           string
	lks               *libkb.LKSec
	kexMu             sync.Mutex
	kex               *KexNewDevice
	canceled          chan struct{}
	provisionRequired bool
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
}

func NewLocksmith(arg *LocksmithArg, g *libkb.GlobalContext) *Locksmith {
	return &Locksmith{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
		canceled:     make(chan struct{}),
	}
}

func (d *Locksmith) Prereqs() Prereqs { return Prereqs{} }

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
	}
}

func (d *Locksmith) Run(ctx *Context) error {
	d.syncSecrets(ctx)

	// check the user, fill in d.status
	if err := d.check(ctx); err != nil {
		return err
	}
	if d.arg.CheckOnly {
		return nil
	}

	// fix the user if necessary (provision a device if needed)
	return d.fix(ctx)
}

func (d *Locksmith) Status() LocksmithStatus {
	return d.status
}

func (d *Locksmith) verifyFixRequirements(ctx *Context) error {
	if ctx.LoginContext == nil {
		return nil
	}

	// If there's a LoginContext, then there must be a PassphraseStreamCache.
	// Otherwise, Locksmith can't provision a device during login.
	//
	// Since this is in the middle of the login process, Locksmith can't use
	// LoginState to get the passphrase stream.  So the caller of locksmith has
	// to do it.
	cached := ctx.LoginContext.PassphraseStreamCache()
	if cached == nil {
		return errors.New("Locksmith can't run with a nil PassphraseStreamCache during login")
	}

	return nil
}

func (d *Locksmith) check(ctx *Context) error {
	var err error
	d.status.NoKeys = !d.hasKeyFamily()
	d.status.CurrentDeviceOk = d.arg.User.HasDeviceInCurrentInstall()
	d.status.HavePGP = d.hasPGP()
	d.status.HaveActiveDevice, err = d.hasActiveDevice(ctx)
	return err
}

func (d *Locksmith) hasKeyFamily() bool {
	kf := d.arg.User.GetKeyFamily()
	if kf == nil {
		return false
	}
	if d.arg.User.GetEldestKID().IsNil() {
		return false
	}
	return true
}

func (d *Locksmith) hasPGP() bool {
	return len(d.arg.User.GetActivePGPKeys(false)) > 0
}

func (d *Locksmith) hasSingleSyncedPGPKey(ctx *Context) bool {
	ckf := d.arg.User.GetComputedKeyFamily()
	if ckf == nil {
		return false
	}

	var count int
	if ctx.LoginContext != nil {
		count = len(ctx.LoginContext.SecretSyncer().AllActiveKeys(ckf))
	} else {
		aerr := d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
			count = len(ss.AllActiveKeys(ckf))
		}, "Locksmith - hasSingleSyncedPGPKey")
		if aerr != nil {
			return false
		}
	}
	return count == 1
}

func (d *Locksmith) fix(ctx *Context) error {
	if err := d.verifyFixRequirements(ctx); err != nil {
		// any errors here need to be fixed in code, so panic to get
		// stack trace:
		panic(err)
	}

	if err := d.checkKeys(ctx); err != nil {
		return err
	}

	if d.provisionRequired {
		// checkKeys provisioned a device, so inform the user:
		return ctx.LocksmithUI.DisplayProvisionSuccess(context.TODO(), keybase1.DisplayProvisionSuccessArg{Username: d.arg.User.GetName()})
	}

	return nil
}

func (d *Locksmith) Cancel() error {
	close(d.canceled)
	d.kexMu.Lock()
	defer d.kexMu.Unlock()
	if d.kex == nil {
		d.G().Log.Debug("Locksmith Cancel called, but kex is nil (so nothing should be running)")
		return nil
	}
	return d.kex.Cancel()
}

// This can fail, but we'll warn if it does.
func (d *Locksmith) syncSecrets(ctx *Context) {
	if ctx.LoginContext != nil {
		if err := ctx.LoginContext.RunSecretSyncer(d.arg.User.GetUID()); err != nil {
			d.G().Log.Warning("Problem syncing secrets from server: %s", err)
		}

	} else {
		if err := d.G().LoginState().RunSecretSyncer(d.arg.User.GetUID()); err != nil {
			d.G().Log.Warning("Problem syncing secrets from server: %s", err)
		}
	}
}

func (d *Locksmith) checkKeys(ctx *Context) error {
	d.G().Log.Debug("+ Locksmith::checkKeys()")
	defer func() {
		d.G().Log.Debug("- Locksmith::checkKeys()")
	}()

	kf := d.arg.User.GetKeyFamily()
	if kf == nil {
		d.G().Log.Debug("| User didn't have a key family")
		return d.addBasicKeys(ctx)
	}
	if d.arg.User.GetEldestKID().IsNil() {
		d.G().Log.Debug("| User didn't have an eldest key")
		return d.addBasicKeys(ctx)
	}

	// they have at least one key

	if d.arg.User.HasDeviceInCurrentInstall() {
		// they have a device sibkey for this device
		d.G().Log.Debug("| User has a device in the current install; all done")
		// no device provisioning performed:
		d.provisionRequired = false
		return nil
	}

	// a new device will be provisioned below, so set this here.
	d.provisionRequired = true

	// make sure secretsyncer loaded --- likely not needed since we
	// already did this above
	d.G().Log.Debug("| Syncing secrets")
	d.syncSecrets(ctx)

	hasPGP := d.hasPGP()

	hasActiveDevice, err := d.hasActiveDevice(ctx)
	if err != nil {
		return err
	}

	if hasActiveDevice {
		// they have at least one device, just not this device...
		d.G().Log.Debug("| User has an active device, just not this one")
		return d.deviceSign(ctx, hasPGP)
	}

	// they don't have any devices.
	d.G().Log.Debug("| the user doesn't have any devices")

	// make sure we have pgp
	if !hasPGP {
		return fmt.Errorf("invalid state:  no pgpkey, no devices, but have some key(s)")
	}

	// deviceSign will handle the rest...
	if err := d.deviceSign(ctx, true); err != nil {
		return err
	}

	// this is the first device for the user, so generate a paper key.
	return d.paperKey(ctx)
}

// addBasicKeys is used for accounts that have no keys.
func (d *Locksmith) addBasicKeys(ctx *Context) error {
	if err := d.addEldestDeviceKey(ctx); err != nil {
		return err
	}

	if err := d.paperKey(ctx); err != nil {
		return err
	}

	// a new device was provisioned:
	d.provisionRequired = true

	return nil
}

// addEldestDeviceKey adds a device sibkey/subkey as the eldest
// key in an account.
func (d *Locksmith) addEldestDeviceKey(ctx *Context) error {
	var nilEldestKID keybase1.KID
	return d.addDeviceKeyWithSigner(ctx, nil, nilEldestKID)
}

// To add a device key as the eldest key, signer and eldestKID
// should be nil.
func (d *Locksmith) addDeviceKeyWithSigner(ctx *Context, signer libkb.GenericKey, eldestKID keybase1.KID) error {
	devname, err := d.deviceName(ctx)
	if err != nil {
		return err
	}
	pps, err := d.ppStream(ctx)
	if err != nil {
		return err
	}
	d.lks = libkb.NewLKSec(pps, d.arg.User.GetUID(), d.G())
	args := &DeviceWrapArgs{
		Me:         d.arg.User,
		DeviceName: devname,
		DeviceType: libkb.DeviceTypeDesktop,
		Lks:        d.lks,
		IsEldest:   false,
		Signer:     signer,
		EldestKID:  eldestKID,
	}
	if signer == nil && eldestKID.IsNil() {
		args.IsEldest = true
	}
	eng := NewDeviceWrap(args, d.G())
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	d.signingKey = eng.SigningKey()
	return nil
}

// deviceSign is used to sign a new installation of keybase on a
// new device.  It happens when the user has keys already, either
// a device key, pgp key, or both.
func (d *Locksmith) deviceSign(ctx *Context, withPGPOption bool) error {
	newDeviceName, err := d.deviceName(ctx)

	if err != nil {
		return err
	}

	devFilter := libkb.DeviceTypeSet{
		libkb.DeviceTypeDesktop: true,
		libkb.DeviceTypeMobile:  true,
		libkb.DeviceTypePaper:   true,
	}
	var devs libkb.DeviceKeyMap
	if ctx.LoginContext != nil {
		devs, err = ctx.LoginContext.SecretSyncer().ActiveDevices(devFilter)
	} else {
		aerr := d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
			devs, err = ss.ActiveDevices(devFilter)
		}, "Locksmith - deviceSign - ActiveDevices")
		if aerr != nil {
			return aerr
		}
	}
	if err != nil {
		return err
	}

	if len(devs) == 0 && withPGPOption {
		if d.hasSingleSyncedPGPKey(ctx) {
			// the user only has a synced pgp key, so bypass the
			// select signer interface.
			return d.deviceSignPGP(ctx)
		}
	}
	var arg keybase1.SelectSignerArg
	for k, v := range devs {
		if v.Type != libkb.DeviceTypePaper {
			arg.Devices = append(arg.Devices, keybase1.Device{Type: v.Type, Name: v.Description, DeviceID: k})
		} else {
			arg.HasPaperBackupKey = true
		}
	}
	arg.HasPGP = withPGPOption

	totalTries := 10
	for i := 0; i < totalTries; i++ {
		if i > 0 {
			ctx.LogUI.Debug("retrying device sign process")
		}

		resCh := make(chan keybase1.SelectSignerRes)
		errCh := make(chan error)

		go func() {
			res, err := ctx.LocksmithUI.SelectSigner(context.TODO(), arg)
			if err != nil {
				errCh <- err
			} else {
				resCh <- res
			}
		}()

		var res keybase1.SelectSignerRes
		select {
		case res = <-resCh:
		case e := <-errCh:
			return e
		case <-d.canceled:
			return libkb.CanceledError{M: "locksmith canceled while prompting user for signer"}
		}

		if res.Action == keybase1.SelectSignerAction_CANCEL {
			return libkb.CanceledError{M: "cancel requested by user"}
		}

		if res.Action != keybase1.SelectSignerAction_SIGN {
			return fmt.Errorf("unknown action value: %d", res.Action)
		}

		// sign action:

		switch res.Signer.Kind {
		case keybase1.DeviceSignerKind_PGP:
			err := d.deviceSignPGP(ctx)
			if err == nil {
				ctx.LogUI.Debug("device sign w/ pgp success")
				return nil
			}

			// If there are no available public keys, and no other ways to login,
			// then no point in continuing. Bail out.
			if _, ok := err.(libkb.NoKeyError); ok && !arg.HasPaperBackupKey && len(arg.Devices) == 0 {
				return err
			}

			ctx.LogUI.Info("PGP: %s", err)
			uiarg := keybase1.DeviceSignAttemptErrArg{
				Msg:     err.Error(),
				Attempt: i + 1,
				Total:   totalTries,
			}
			if err = ctx.LocksmithUI.DeviceSignAttemptErr(context.TODO(), uiarg); err != nil {
				d.G().Log.Info("error making ui call DeviceSignAttemptErr: %s", err)
			}
		case keybase1.DeviceSignerKind_DEVICE:
			if res.Signer.DeviceID == nil {
				return fmt.Errorf("selected device for signing, but DeviceID is nil")
			}
			if res.Signer.DeviceName == nil {
				return fmt.Errorf("selected device for signing, but DeviceName is nil")
			}
			err := d.deviceSignExistingDevice(ctx, *res.Signer.DeviceID, *res.Signer.DeviceName, newDeviceName, libkb.DeviceTypeDesktop)
			if err == nil {
				ctx.LogUI.Debug("device sign w/ existing device success")
				return nil
			}
			ctx.LogUI.Info("deviceSignExistingDevice error: %s", err)
			if err == kex.ErrProtocolEOF {
				ctx.LogUI.Info("deviceSignExistingDevice not retrying after EOF error")
				return libkb.CanceledError{}
			}
			if _, ok := err.(libkb.AppStatusError); ok {
				ctx.LogUI.Info("deviceSignExistingDevice not retrying after AppStatusError: %s", err)
				return err
			}
			uiarg := keybase1.DeviceSignAttemptErrArg{
				Msg:     err.Error(),
				Attempt: i + 1,
				Total:   totalTries,
			}
			if err = ctx.LocksmithUI.DeviceSignAttemptErr(context.TODO(), uiarg); err != nil {
				d.G().Log.Info("error making ui call DeviceSignAttemptErr: %s", err)
			}
		case keybase1.DeviceSignerKind_PAPER_BACKUP_KEY:
			err := d.deviceSignPaper(ctx)
			if err == nil {
				ctx.LogUI.Debug("device sign w/ paper backup key success")
				return nil
			}
			ctx.LogUI.Errorf("deviceSignPaper error: %s", err)
			uiarg := keybase1.DeviceSignAttemptErrArg{
				Msg:     err.Error(),
				Attempt: i + 1,
				Total:   totalTries,
			}
			if err = ctx.LocksmithUI.DeviceSignAttemptErr(context.TODO(), uiarg); err != nil {
				d.G().Log.Info("error making ui call DeviceSignAttemptErr: %s", err)
			}
		default:
			return fmt.Errorf("unknown signer kind: %d", res.Signer.Kind)
		}
	}

	return fmt.Errorf("device sign process retry attempts exhausted")
}

func (d *Locksmith) deviceSignPGP(ctx *Context) (err error) {
	d.G().Log.Debug("+ deviceSignPGP")
	defer func() {
		d.G().Log.Debug("- deviceSignPGP -> %s", libkb.ErrToOk(err))
	}()
	pgpKeys := d.arg.User.GetActivePGPKeys(false)
	if len(pgpKeys) == 0 {
		err = errors.New("no active PGP keys unexpectedly")
		return err
	}
	var selected *libkb.PGPKeyBundle
	if len(pgpKeys) > 1 {
		// show a list of pgp keys and let them select which one to use
		selected, err = d.selectPGPKey(ctx, pgpKeys)
		if err != nil {
			return err
		}
		if selected == nil {
			err = fmt.Errorf("no key selected")
			return err
		}
	} else {
		selected = pgpKeys[0]
	}

	ctx.LogUI.Debug("selected pgp key: %s", selected.VerboseDescription())
	ctx.LogUI.Debug("selected pgp key kid: %s", selected.GetKID())

	var pk libkb.ServerPrivateKey
	var ok bool
	if ctx.LoginContext != nil {
		pk, ok = ctx.LoginContext.SecretSyncer().FindPrivateKey(selected.GetKID().String())
	} else {
		err = d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
			pk, ok = ss.FindPrivateKey(selected.GetKID().String())
		}, "Locksmith - deviceSignPGP - FindPrivateKey")
		if err != nil {
			return err
		}
	}
	if ok {
		d.G().Log.Debug("| found synced secret key, unlocking it")
		skb, serr := pk.ToSKB(d.G())
		if serr != nil {
			err = serr
			return err
		}

		pgpk, perr := skb.PromptAndUnlock(ctx.LoginContext, "sign new device", "keybase", nil, ctx.SecretUI, nil, d.arg.User)
		if perr != nil {
			err = perr
			return err
		}
		return d.deviceSignPGPNext(ctx, pgpk)
	}

	// use gpg to unlock it
	gpg := d.G().GetGpgClient()
	if err = gpg.Configure(); err != nil {
		return err
	}

	bundle, ierr := gpg.ImportKey(true, selected.GetFingerprint())
	if ierr != nil {
		err = ierr
		return err
	}

	if err = bundle.Unlock("adding this device to your account", ctx.SecretUI); err != nil {
		err = fmt.Errorf("bundle Unlock error: %s", err)
		return err
	}

	return d.deviceSignPGPNext(ctx, bundle)
}

func (d *Locksmith) deviceSignPGPNext(ctx *Context, pgpk libkb.GenericKey) error {
	if pgpk.CanSign() == false {
		return fmt.Errorf("pgp key can't sign")
	}

	eldest := d.arg.User.GetEldestKID()
	ctx.LogUI.Debug("eldest kid from user: %s", eldest)
	if err := d.addDeviceKeyWithSigner(ctx, pgpk, eldest); err != nil {
		return err
	}

	return nil
}

func (d *Locksmith) deviceSignExistingDevice(ctx *Context, existingID keybase1.DeviceID, existingName, newDevName, newDevType string) error {
	ctx.LogUI.Debug("device sign with existing device [%s]", existingID)
	ctx.LogUI.Debug("new device name: %s", newDevName)

	pps, err := d.ppStream(ctx)
	if err != nil {
		return err
	}

	kargs := &KexNewDeviceArgs{
		User:    d.arg.User,
		Dst:     existingID,
		DstName: existingName,
		DevType: newDevType,
		DevDesc: newDevName,
	}

	d.kexMu.Lock()
	d.kex = NewKexNewDevice(pps, kargs, d.G())
	d.kexMu.Unlock()

	err = RunEngine(d.kex, ctx)

	d.kexMu.Lock()
	d.kex = nil
	d.kexMu.Unlock()

	return err
}

func (d *Locksmith) deviceSignPaper(ctx *Context) error {
	kp, err := findPaperKeys(ctx, d.G(), d.arg.User)
	if err != nil {
		return err
	}

	eldest := d.arg.User.GetEldestKID()
	ctx.LogUI.Debug("eldest kid from user: %s", eldest)
	if err := d.addDeviceKeyWithSigner(ctx, kp.sigKey, eldest); err != nil {
		return err
	}

	return nil
}

func (d *Locksmith) selectPGPKey(ctx *Context, keys []*libkb.PGPKeyBundle) (*libkb.PGPKeyBundle, error) {
	var gks []keybase1.GPGKey
	for _, key := range keys {
		algo, kid, creation := key.KeyInfo()
		gk := keybase1.GPGKey{
			Algorithm:  algo,
			KeyID:      kid,
			Creation:   creation,
			Identities: key.GetPGPIdentities(),
		}
		gks = append(gks, gk)
	}

	keyid, err := ctx.GPGUI.SelectKey(context.TODO(), keybase1.SelectKeyArg{Keys: gks})
	if err != nil {
		return nil, err
	}
	ctx.LogUI.Debug("SelectKey result: %+v", keyid)

	var selected *libkb.PGPKeyBundle
	for _, key := range keys {
		if key.GetFingerprint().ToKeyID() == keyid {
			selected = key
			break
		}
	}

	return selected, nil
}

func (d *Locksmith) ppStream(ctx *Context) (ret *libkb.PassphraseStream, err error) {
	if ctx.LoginContext != nil {
		cached := ctx.LoginContext.PassphraseStreamCache()
		if cached == nil {
			return ret, errors.New("nil PassphraseStreamCache")
		}
		return cached.PassphraseStream(), nil
	}

	return d.G().LoginState().GetPassphraseStream(ctx.SecretUI)
}

var ErrDeviceMustBeUnique = errors.New("device name must be unique")

func (d *Locksmith) deviceName(ctx *Context) (string, error) {
	if len(d.devName) > 0 {
		return d.devName, nil
	}

	nameCh := make(chan string)
	errCh := make(chan error)

	go func() {
		for i := 0; i < 10; i++ {
			name, err := ctx.LocksmithUI.PromptDeviceName(context.TODO(), 0)
			if err != nil {
				errCh <- err
				return
			}
			if !libkb.CheckDeviceName.F(name) {
				errCh <- errors.New("Invalid device name")
				return
			}

			if len(name) > 0 && !d.isDeviceNameTaken(ctx, name) {
				nameCh <- name
				return
			}
			err = ctx.LocksmithUI.DeviceNameTaken(context.TODO(), keybase1.DeviceNameTakenArg{Name: name})
			if err != nil {
				errCh <- err
				return
			}
		}
		errCh <- ErrDeviceMustBeUnique
	}()

	select {
	case n := <-nameCh:
		d.devName = n
		return d.devName, nil
	case e := <-errCh:
		return "", e
	case <-d.canceled:
		return "", libkb.CanceledError{M: "locksmith canceled while getting device name"}
	}
}

func (d *Locksmith) hasActiveDevice(ctx *Context) (bool, error) {
	var res bool
	var err error
	if ctx.LoginContext != nil {
		res, err = ctx.LoginContext.SecretSyncer().HasActiveDevice(libkb.DefaultDeviceTypes)
	} else {
		var ierr error
		err := d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
			res, ierr = ss.HasActiveDevice(libkb.DefaultDeviceTypes)
		}, "Locksmith - hasActiveDevice")
		if ierr != nil {
			d.G().Log.Warning("secret syncer error in hasActiveDevices: %s", ierr)
			return false, ierr
		}
		if err != nil {
			d.G().Log.Warning("secret syncer error in hasActiveDevices: %s", err)
			return false, err
		}
	}
	return res, err
}

func (d *Locksmith) isDeviceNameTaken(ctx *Context, name string) bool {
	if ctx.LoginContext != nil {
		return ctx.LoginContext.SecretSyncer().IsDeviceNameTaken(name, libkb.DefaultDeviceTypes)
	}

	var taken bool
	err := d.G().LoginState().SecretSyncer(func(ss *libkb.SecretSyncer) {
		taken = ss.IsDeviceNameTaken(name, libkb.DefaultDeviceTypes)
	}, "Locksmith - isDeviceNameTaken")
	if err != nil {
		d.G().Log.Warning("secret syncer error in isDeviceNameTaken: %s", err)
	}
	return taken
}

func (d *Locksmith) paperKey(ctx *Context) error {
	args := &PaperKeyPrimaryArgs{
		SigningKey: d.signingKey,
		Me:         d.arg.User,
	}
	eng := NewPaperKeyPrimary(d.G(), args)
	return RunEngine(eng, ctx)
}
