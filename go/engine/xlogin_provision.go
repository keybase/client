package engine

import (
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
	deviceType string
}

// NewXLoginProvision creates a XLoginProvision engine.
func NewXLoginProvision(g *libkb.GlobalContext, deviceType string) *XLoginProvision {
	return &XLoginProvision{
		Contextified: libkb.NewContextified(g),
		deviceType:   deviceType,
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
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *XLoginProvision) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *XLoginProvision) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ XLoginProvision.Run()")
	defer func() { e.G().Log.Debug("- XLoginProvision.Run() -> %s", libkb.ErrToOk(err)) }()

	// check we have a good device type:
	if e.deviceType != libkb.DeviceTypeDesktop && e.deviceType != libkb.DeviceTypeMobile {
		err = fmt.Errorf("device type must be %q or %q, not %q", libkb.DeviceTypeDesktop, libkb.DeviceTypeMobile, e.deviceType)
		return err
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
	e.G().Log.Debug("chosen method: %v", method)

	switch method {
	case keybase1.ProvisionMethod_DEVICE:
		err = e.device(ctx)
	case keybase1.ProvisionMethod_GPG:
		err = e.gpg(ctx)
	case keybase1.ProvisionMethod_PAPER_KEY:
		err = e.paper(ctx)
	case keybase1.ProvisionMethod_PASSPHRASE:
		err = e.passphrase(ctx)
	default:
		err = fmt.Errorf("unhandled provisioning method: %v", method)
	}

	return err
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
		Type: e.deviceType,
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
	// prompt for username (if not provided)
	// load the user
	// check if they have any paper keys
	// if they do, can call findPaperKeys
	// if that succeeds, then need to get ppstream (for lks).
	// addDeviceKeyWithSigner
	panic("paper provision not yet implemented")
}

func (e *XLoginProvision) passphrase(ctx *Context) error {
	// prompt for the username (if not provided)
	// load the user
	// check if they have any devices
	// if they do, abort
	// if they have a synced private pgp key, then provision with that
	// otherwise, add device keys as eldest keys (again, need ppstream)
	panic("passphrase provision not yet implemented")
}

func (e *XLoginProvision) loadUser(ctx *Context) (*libkb.User, error) {
	return nil, nil
}
