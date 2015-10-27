package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// DeviceWrap is an engine that wraps DeviceRegister and
// DeviceKeygen.
type DeviceWrap struct {
	args *DeviceWrapArgs

	signingKey libkb.GenericKey
	libkb.Contextified
}

type DeviceWrapArgs struct {
	Me         *libkb.User
	DeviceName string
	DeviceType string
	Lks        *libkb.LKSec
	IsEldest   bool
	Signer     libkb.GenericKey
	EldestKID  keybase1.KID
}

// NewDeviceWrap creates a DeviceWrap engine.
func NewDeviceWrap(args *DeviceWrapArgs, g *libkb.GlobalContext) *DeviceWrap {
	return &DeviceWrap{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *DeviceWrap) Name() string {
	return "DeviceWrap"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceWrap) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *DeviceWrap) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceWrap) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceRegister{},
		&DeviceKeygen{},
	}
}

// Run starts the engine.
func (e *DeviceWrap) Run(ctx *Context) error {
	regArgs := &DeviceRegisterArgs{
		Me:   e.args.Me,
		Name: e.args.DeviceName,
		Lks:  e.args.Lks,
	}
	regEng := NewDeviceRegister(regArgs, e.G())
	if err := RunEngine(regEng, ctx); err != nil {
		return err
	}

	deviceID := regEng.DeviceID()

	kgArgs := &DeviceKeygenArgs{
		Me:         e.args.Me,
		DeviceID:   deviceID,
		DeviceName: e.args.DeviceName,
		DeviceType: e.args.DeviceType,
		Lks:        e.args.Lks,
	}
	kgEng := NewDeviceKeygen(kgArgs, e.G())
	if err := RunEngine(kgEng, ctx); err != nil {
		return err
	}

	pargs := &DeviceKeygenPushArgs{
		IsEldest:  e.args.IsEldest,
		Signer:    e.args.Signer,
		EldestKID: e.args.EldestKID,
	}
	if err := kgEng.Push(ctx, pargs); err != nil {
		return err
	}

	e.signingKey = kgEng.SigningKey()

	return nil
}

func (e *DeviceWrap) SigningKey() libkb.GenericKey {
	return e.signingKey
}
