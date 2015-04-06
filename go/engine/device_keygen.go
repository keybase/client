package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

type DeviceKeygenArgs struct {
	Me         *libkb.User
	DeviceID   libkb.DeviceID
	DeviceName string
	Lks        *libkb.LKSec
	NeedEldest bool
	Signer     libkb.GenericKey
	EldestKID  libkb.KID
}

// NewDeviceKeygenArgsEldest creates the args for the engine when
// it is generating keys for the eldest device in the chain.
func NewDeviceKeygenArgsEldest(me *libkb.User, lks *libkb.LKSec, devid libkb.DeviceID, devname string) *DeviceKeygenArgs {
	args := newDeviceKeygenArgs(me, lks, devid, devname)
	args.NeedEldest = true
	return args
}

// NewDeviceKeygenArgsSibkey creates the args for the engine when
// it is generating keys for a sibling device in the chain.
func NewDeviceKeygenArgsSibling(me *libkb.User, lks *libkb.LKSec, devid libkb.DeviceID, devname string, signer libkb.GenericKey, eldestKID libkb.KID) *DeviceKeygenArgs {
	args := newDeviceKeygenArgs(me, lks, devid, devname)
	args.Signer = signer
	args.EldestKID = eldestKID
	return args
}

func newDeviceKeygenArgs(me *libkb.User, lks *libkb.LKSec, devid libkb.DeviceID, devname string) *DeviceKeygenArgs {
	return &DeviceKeygenArgs{Me: me, Lks: lks, DeviceID: devid, DeviceName: devname}
}

// DeviceKeygen is an engine.
type DeviceKeygen struct {
	args      *DeviceKeygenArgs
	eldestKey libkb.NaclKeyPair
	newSibkey libkb.NaclKeyPair
}

// NewDeviceKeygen creates a DeviceKeygen engine.
func NewDeviceKeygen(args *DeviceKeygenArgs) *DeviceKeygen {
	return &DeviceKeygen{args: args}
}

// Name is the unique engine name.
func (e *DeviceKeygen) Name() string {
	return "DeviceKeygen"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceKeygen) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *DeviceKeygen) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceKeygen) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *DeviceKeygen) Run(ctx *Context) error {
	var signer libkb.GenericKey
	eldestKID := e.args.EldestKID
	if e.args.NeedEldest {
		if err := e.pushEldestKey(ctx); err != nil {
			return err
		}
		signer = e.eldestKey
		eldestKID = e.eldestKey.GetKid()
	} else {
		var err error
		if signer, err = e.pushSibKey(ctx, e.args.Signer, e.args.EldestKID); err != nil {
			return err
		}
	}

	if err := e.pushDHKey(ctx, signer, eldestKID); err != nil {
		return err
	}

	if err := e.pushLocalKeySec(); err != nil {
		return err
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	if err := libkb.RunSyncer(G.SecretSyncer, e.args.Me.GetUid().P()); err != nil {
		return fmt.Errorf("runsync err: %s", err)
	}

	return nil
}

func (d *DeviceKeygen) EldestKey() libkb.GenericKey {
	return d.eldestKey
}

func (e *DeviceKeygen) pushEldestKey(ctx *Context) error {
	gen := libkb.NewNaclKeyGen(&libkb.NaclKeyGenArg{
		Generator: libkb.GenerateNaclSigningKeyPair,
		Me:        e.args.Me,
		ExpireIn:  libkb.NACL_EDDSA_EXPIRE_IN,
		Device:    e.device(),
		LogUI:     ctx.LogUI,
	})
	err := gen.RunLKS(e.args.Lks)
	if err != nil {
		return err
	}
	e.eldestKey = gen.GetKeyPair()
	return nil
}

func (e *DeviceKeygen) pushSibKey(ctx *Context, signer libkb.GenericKey, eldestKID libkb.KID) (libkb.GenericKey, error) {
	gen := libkb.NewNaclKeyGen(&libkb.NaclKeyGenArg{
		Signer:      signer,
		EldestKeyID: eldestKID,
		Generator:   libkb.GenerateNaclSigningKeyPair,
		Sibkey:      true,
		Me:          e.args.Me,
		ExpireIn:    libkb.NACL_EDDSA_EXPIRE_IN,
		Device:      e.device(),
		LogUI:       ctx.LogUI,
	})
	err := gen.RunLKS(e.args.Lks)
	if err != nil {
		return nil, err
	}
	e.newSibkey = gen.GetKeyPair()
	return e.newSibkey, nil
}

func (e *DeviceKeygen) pushDHKey(ctx *Context, signer libkb.GenericKey, eldestKID libkb.KID) error {
	gen := libkb.NewNaclKeyGen(&libkb.NaclKeyGenArg{
		Signer:      signer,
		EldestKeyID: eldestKID,
		Generator:   libkb.GenerateNaclDHKeyPair,
		Sibkey:      false,
		Me:          e.args.Me,
		ExpireIn:    libkb.NACL_DH_EXPIRE_IN,
		Device:      e.device(),
		LogUI:       ctx.LogUI,
	})

	return gen.RunLKS(e.args.Lks)
}

func (e *DeviceKeygen) device() *libkb.Device {
	s := libkb.DEVICE_STATUS_ACTIVE
	return &libkb.Device{
		Id:          e.args.DeviceID.String(),
		Description: &e.args.DeviceName,
		Type:        libkb.DEVICE_TYPE_DESKTOP,
		Status:      &s,
	}
}

func (d *DeviceKeygen) pushLocalKeySec() error {
	if d.args.Lks == nil {
		return fmt.Errorf("no local key security set")
	}

	serverHalf := d.args.Lks.GetServerHalf()
	if serverHalf == nil {
		return fmt.Errorf("LKS server half is nil, and should not be")
	}
	if len(serverHalf) == 0 {
		return fmt.Errorf("LKS server half is empty, and should not be")
	}

	// send it to api server
	return libkb.PostDeviceLKS(d.args.DeviceID.String(), libkb.DEVICE_TYPE_DESKTOP, serverHalf)
}
