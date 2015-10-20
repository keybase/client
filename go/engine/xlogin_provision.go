package engine

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// XLoginProvision is an engine that will provision the current
// device.
type XLoginProvision struct {
	libkb.Contextified
}

// NewXLoginProvision creates a XLoginProvision engine.
func NewXLoginProvision(g *libkb.GlobalContext) *XLoginProvision {
	return &XLoginProvision{
		Contextified: libkb.NewContextified(g),
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

func (e *XLoginProvision) device(ctx *Context) error {
	panic("device provision not yet implemented")
}

func (e *XLoginProvision) gpg(ctx *Context) error {
	panic("gpg provision not yet implemented")
}

func (e *XLoginProvision) paper(ctx *Context) error {
	panic("paper provision not yet implemented")
}

func (e *XLoginProvision) passphrase(ctx *Context) error {
	panic("passphrase provision not yet implemented")
}
