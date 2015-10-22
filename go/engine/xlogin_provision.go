package engine

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// XLoginProvision is an engine that will provision the current
// device.
type XLoginProvision struct {
	libkb.Contextified
	arg        *XLoginProvisionArg
	user       *libkb.User
	lks        *libkb.LKSec
	signingKey libkb.GenericKey
}

type XLoginProvisionArg struct {
	DeviceType string // desktop or mobile
	Username   string // optional
}

// NewXLoginProvision creates a XLoginProvision engine.  username
// is optional.
func NewXLoginProvision(g *libkb.GlobalContext, arg *XLoginProvisionArg) *XLoginProvision {
	return &XLoginProvision{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *XLoginProvision) Name() string {
	return "XLoginProvision"
}

// GetPrereqs returns the engine prereqs.
func (e *XLoginProvision) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *XLoginProvision) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ProvisionUIKind,
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *XLoginProvision) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceWrap{},
		&PaperKeyPrimary{},
	}
}

// Run starts the engine.
func (e *XLoginProvision) Run(ctx *Context) error {
	// check we have a good device type:
	if e.arg.DeviceType != libkb.DeviceTypeDesktop && e.arg.DeviceType != libkb.DeviceTypeMobile {
		return fmt.Errorf("device type must be %q or %q, not %q", libkb.DeviceTypeDesktop, libkb.DeviceTypeMobile, e.arg.DeviceType)
	}

	availableGPGPrivateKeyUsers, err := e.searchGPG(ctx)
	if err != nil {
		return err
	}
	e.G().Log.Debug("available private gpg key users: %v", availableGPGPrivateKeyUsers)

	arg := keybase1.ChooseProvisioningMethodArg{
		GpgUsers: availableGPGPrivateKeyUsers,
	}
	method, err := ctx.ProvisionUI.ChooseProvisioningMethod(context.TODO(), arg)
	if err != nil {
		return err
	}

	switch method {
	case keybase1.ProvisionMethod_DEVICE:
		return e.device(ctx)
	case keybase1.ProvisionMethod_GPG:
		return e.gpg(ctx)
	case keybase1.ProvisionMethod_PAPER_KEY:
		return e.paper(ctx)
	case keybase1.ProvisionMethod_PASSPHRASE:
		return e.passphrase(ctx)
	}

	return fmt.Errorf("unhandled provisioning method: %v", method)
}

// searchGPG looks in local gpg keyring for any private keys
// associated with keybase users.
//
// TODO: implement this
//
func (e *XLoginProvision) searchGPG(ctx *Context) ([]string, error) {
	return nil, nil
}

// device provisions this device with an existing device using the
// kex2 protocol.
func (e *XLoginProvision) device(ctx *Context) error {
	provisionerType, err := ctx.ProvisionUI.ChooseDeviceType(context.TODO(), 0)
	if err != nil {
		return err
	}
	e.G().Log.Debug("provisioner device type: %v", provisionerType)

	// make a new secret:
	secret, err := libkb.NewKex2Secret()
	if err != nil {
		return err
	}
	e.G().Log.Debug("secret phrase: %s", secret.Phrase())

	// make a new device:
	deviceID, err := libkb.NewDeviceID()
	if err != nil {
		return err
	}
	device := &libkb.Device{
		ID:   deviceID,
		Type: e.arg.DeviceType,
	}

	// create provisionee engine
	provisionee := NewKex2Provisionee(e.G(), device, secret.Secret())

	var canceler func()

	// display secret and prompt for secret from X in a goroutine:
	go func() {
		sb := secret.Secret()
		arg := keybase1.DisplayAndPromptSecretArg{
			Secret:          sb[:],
			Phrase:          secret.Phrase(),
			OtherDeviceType: provisionerType,
		}
		var contxt context.Context
		contxt, canceler = context.WithCancel(context.Background())
		receivedSecret, err := ctx.ProvisionUI.DisplayAndPromptSecret(contxt, arg)
		if err != nil {
			// XXX ???
			e.G().Log.Warning("DisplayAndPromptSecret error: %s", err)
		} else if receivedSecret != nil {
			var ks kex2.Secret
			copy(ks[:], receivedSecret)
			provisionee.AddSecret(ks)
		}
	}()

	defer func() {
		if canceler != nil {
			e.G().Log.Debug("canceling DisplayAndPromptSecret call")
			canceler()
		}
	}()

	// run provisionee
	if err := RunEngine(provisionee, ctx); err != nil {
		return err
	}

	return nil
}

func (e *XLoginProvision) gpg(ctx *Context) error {
	panic("gpg provision not yet implemented")
}

func (e *XLoginProvision) paper(ctx *Context) error {
	// prompt for the username (if not provided) and load the user:
	// check if they have any paper keys
	// if they do, can call findPaperKeys
	// if that succeeds, then need to get ppstream (for lks).
	// addDeviceKeyWithSigner
	panic("paper provision not yet implemented")
}

func (e *XLoginProvision) passphrase(ctx *Context) error {
	// prompt for the username (if not provided) and load the user:
	var err error
	e.user, err = e.loadUser(ctx)
	if err != nil {
		return err
	}

	// check if they have any devices, pgp keys
	hasPGP := false
	ckf := e.user.GetComputedKeyFamily()
	if ckf != nil {
		devices := ckf.GetAllDevices()
		for _, dev := range devices {
			if *dev.Status == libkb.DeviceStatusActive {
				return libkb.PassphraseProvisionImpossibleError{}
			}
		}
		hasPGP = len(ckf.GetActivePGPKeys(false)) > 0
	}

	// if they have any pgp keys in their family, there's a chance there is a synced
	// pgp key, so try provisioning with it.
	if hasPGP {
		e.G().Log.Debug("user %q has a pgp key, trying to provision with it", e.user.GetName())
		if err := e.pgpProvision(ctx); err != nil {
			return err
		}
	} else {
		e.G().Log.Debug("user %q has no devices, no pgp keys", e.user.GetName())
		if err := e.addEldestDeviceKey(ctx); err != nil {
			return err
		}
	}

	// and finally, a paper key, since this is their first device
	if err := e.paperKey(ctx); err != nil {
		return err
	}

	return nil
}

func (e *XLoginProvision) pgpProvision(ctx *Context) error {
	// need a session to try to get synced private key
	if err := e.G().LoginState().LoginWithPrompt(e.user.GetName(), ctx.LoginUI, ctx.SecretUI, nil); err != nil {
		return err
	}

	// this could go in afterFn of LoginWithPrompt?

	unlocked, err := e.syncedPGPKey(ctx)
	if err != nil {
		return err
	}

	args, err := e.makeDeviceWrapArgs(ctx)
	if err != nil {
		return err
	}
	args.Signer = unlocked
	args.IsEldest = false
	args.EldestKID = e.user.GetEldestKID()

	return e.makeDeviceKeys(ctx, args)
}

func (e *XLoginProvision) addEldestDeviceKey(ctx *Context) error {
	args, err := e.makeDeviceWrapArgs(ctx)
	if err != nil {
		return err
	}
	args.IsEldest = true

	return e.makeDeviceKeys(ctx, args)
}

func (e *XLoginProvision) paperKey(ctx *Context) error {
	args := &PaperKeyPrimaryArgs{
		SigningKey: e.signingKey,
		Me:         e.user,
	}
	eng := NewPaperKeyPrimary(e.G(), args)
	return RunEngine(eng, ctx)
}

func (e *XLoginProvision) deviceName(ctx *Context) (string, error) {
	// TODO: get existing device names
	arg := keybase1.PromptNewDeviceNameArg{}
	return ctx.ProvisionUI.PromptNewDeviceName(context.TODO(), arg)
}

func (e *XLoginProvision) ppStream(ctx *Context) (*libkb.PassphraseStream, error) {
	return e.G().LoginState().GetPassphraseStream(ctx.SecretUI)
}

// ensure we have LKSec for saving device keys.
func (e *XLoginProvision) ensureLKSec(ctx *Context) error {
	if e.lks != nil {
		return nil
	}

	pps, err := e.ppStream(ctx)
	if err != nil {
		return err
	}

	e.lks = libkb.NewLKSec(pps, e.user.GetUID(), e.G())
	return nil
}

func (e *XLoginProvision) makeDeviceWrapArgs(ctx *Context) (*DeviceWrapArgs, error) {
	if err := e.ensureLKSec(ctx); err != nil {
		return nil, err
	}

	devname, err := e.deviceName(ctx)
	if err != nil {
		return nil, err
	}

	return &DeviceWrapArgs{
		Me:         e.user,
		DeviceName: devname,
		Lks:        e.lks,
	}, nil
}

func (e *XLoginProvision) makeDeviceKeys(ctx *Context, args *DeviceWrapArgs) error {
	eng := NewDeviceWrap(args, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	e.signingKey = eng.SigningKey()
	return nil
}

// prompt for username (if not provided) and load the user.
func (e *XLoginProvision) loadUser(ctx *Context) (*libkb.User, error) {
	if len(e.arg.Username) == 0 {
		username, err := ctx.LoginUI.GetEmailOrUsername(context.TODO(), 0)
		if err != nil {
			return nil, err
		}
		e.arg.Username = username
	}
	arg := libkb.NewLoadUserByNameArg(e.G(), e.arg.Username)
	arg.PublicKeyOptional = true
	return libkb.LoadUser(arg)
}

func (e *XLoginProvision) syncedPGPKey(ctx *Context) (libkb.GenericKey, error) {
	key, err := e.user.SyncedSecretKey(nil)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, errors.New("failed to get synced secret key")
	}

	e.G().Log.Debug("got synced secret key")

	// unlock it
	unlocked, err := key.PromptAndUnlock(nil, "sign new device", "keybase", nil, ctx.SecretUI, nil, e.user)
	if err != nil {
		return nil, err
	}

	e.G().Log.Debug("unlocked secret key")
	return unlocked, nil
}
