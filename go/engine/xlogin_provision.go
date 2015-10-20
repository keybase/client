package engine

import (
	"github.com/keybase/client/go/libkb"
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
	return []libkb.UIKind{}
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

	return nil
}

// searchGPG looks in local gpg keyring for any private keys
// associated with keybase users.
//
// TODO: implement this
//
func (e *XLoginProvision) searchGPG(ctx *Context) ([]string, error) {
	return nil, nil
}
