package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

type DevKeygenArgs struct {
	Me         *libkb.User
	DeviceID   libkb.DeviceID
	DeviceName string
	Lks        *libkb.LKSec
}

// DevKeygenPushArgs determines how the push will run.  There are
// currently three different paths it can take:
//
// 1. this device is the eldest device:  pushes eldest signing
// key, encryption subkey. (IsEldest => true)
//
// 2. this device is a sibling (but we're not in a key exchange
// scenario):  pushes sibkey signing key, encryption subkey.
// (IsEldest => False, SkipSignerPush => false, Signer != nil,
// EldestKID != nil)
//
// 3. this device is a sibling, but another device pushed
// the signing key, so skip that part.
// (IsEldest => False, SkipSignerPush => true, Signer != nil,
// EldestKID != nil)
//
type DevKeygenPushArgs struct {
	IsEldest       bool
	SkipSignerPush bool
	Signer         libkb.GenericKey
	EldestKID      libkb.KID
}

type DevKeygen struct {
	args *DevKeygenArgs

	runErr  error
	pushErr error

	naclSignArg *libkb.NaclKeyGenArg
	naclSignGen *libkb.NaclKeyGen
	naclEncArg  *libkb.NaclKeyGenArg
	naclEncGen  *libkb.NaclKeyGen
}

// NewDeviceKeygen creates a DeviceKeygen engine.
func NewDevKeygen(args *DevKeygenArgs) *DevKeygen {
	return &DevKeygen{args: args}
}

// Name is the unique engine name.
func (e *DevKeygen) Name() string {
	return "DevKeygen"
}

// GetPrereqs returns the engine prereqs.
func (e *DevKeygen) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *DevKeygen) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DevKeygen) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *DevKeygen) Run(ctx *Context) error {
	e.setup(ctx)
	e.generate()
	e.localSave()
	return e.runErr
}

func (e *DevKeygen) SigningKeyPublic() (libkb.NaclSigningKeyPublic, error) {
	s, ok := e.naclSignGen.GetKeyPair().(libkb.NaclSigningKeyPair)
	if !ok {
		return libkb.NaclSigningKeyPublic{}, libkb.BadKeyError{Msg: fmt.Sprintf("invalid key type %T", e.naclSignGen.GetKeyPair())}
	}
	return s.Public, nil

}

func (e *DevKeygen) SigningKey() libkb.NaclKeyPair {
	return e.naclSignGen.GetKeyPair()
}

// Push pushes the generated keys to the api server and stores the
// local key security server half on the api server as well.
func (e *DevKeygen) Push(ctx *Context, pargs *DevKeygenPushArgs) error {
	var encSigner libkb.GenericKey
	eldestKID := pargs.EldestKID

	// push the signing key
	if pargs.IsEldest {
		e.pushEldest(pargs)
		encSigner = e.naclSignGen.GetKeyPair()
		eldestKID = encSigner.GetKid()
	} else if !pargs.SkipSignerPush {
		e.pushSibkey(pargs)
		encSigner = e.naclSignGen.GetKeyPair()
	} else {
		encSigner = pargs.Signer
	}

	// push the encryption key
	e.pushEncKey(encSigner, eldestKID)

	// push the LKS server half
	e.pushLKS()

	return e.pushErr
}

func (e *DevKeygen) setup(ctx *Context) {
	if e.runErr != nil {
		return
	}

	e.naclSignArg = e.newNaclArg(ctx, libkb.GenerateNaclSigningKeyPair, libkb.NACL_EDDSA_EXPIRE_IN)
	e.naclSignGen = libkb.NewNaclKeyGen(e.naclSignArg)

	e.naclEncArg = e.newNaclArg(ctx, libkb.GenerateNaclDHKeyPair, libkb.NACL_DH_EXPIRE_IN)
	e.naclEncGen = libkb.NewNaclKeyGen(e.naclEncArg)
}

func (e *DevKeygen) generate() {
	if e.runErr != nil {
		return
	}

	if e.runErr = e.naclSignGen.Generate(); e.runErr != nil {
		return
	}

	if e.runErr = e.naclEncGen.Generate(); e.runErr != nil {
		return
	}
}

func (e *DevKeygen) localSave() {
	if e.runErr != nil {
		return
	}

	if e.runErr = e.naclSignGen.SaveLKS(e.args.Lks); e.runErr != nil {
		return
	}
	if e.runErr = e.naclEncGen.SaveLKS(e.args.Lks); e.runErr != nil {
		return
	}
}

func (e *DevKeygen) pushEldest(pargs *DevKeygenPushArgs) {
	if e.pushErr != nil {
		return
	}
	_, e.pushErr = e.naclSignGen.Push()
}

func (e *DevKeygen) pushSibkey(pargs *DevKeygenPushArgs) {
	if e.pushErr != nil {
		return
	}

	e.naclSignArg.Signer = pargs.Signer
	e.naclSignArg.EldestKeyID = pargs.EldestKID
	e.naclSignArg.Sibkey = true
	_, e.pushErr = e.naclSignGen.Push()
}

func (e *DevKeygen) pushEncKey(signer libkb.GenericKey, eldestKID libkb.KID) {
	if e.pushErr != nil {
		return
	}
	e.naclEncArg.Signer = signer
	e.naclEncArg.EldestKeyID = eldestKID
	_, e.pushErr = e.naclEncGen.Push()
}

func (e *DevKeygen) pushLKS() {
	if e.pushErr != nil {
		return
	}

	if e.args.Lks == nil {
		e.pushErr = fmt.Errorf("no local key security set")
		return
	}

	serverHalf := e.args.Lks.GetServerHalf()
	if len(serverHalf) == 0 {
		e.pushErr = fmt.Errorf("LKS server half is empty, and should not be")
		return
	}

	// send it to api server
	e.pushErr = libkb.PostDeviceLKS(e.args.DeviceID.String(), libkb.DEVICE_TYPE_DESKTOP, serverHalf)
}

func (e *DevKeygen) newNaclArg(ctx *Context, gen libkb.NaclGenerator, expire int) *libkb.NaclKeyGenArg {
	return &libkb.NaclKeyGenArg{
		Generator: gen,
		Device:    e.device(),
		Me:        e.args.Me,
		ExpireIn:  expire,
		LogUI:     ctx.LogUI,
	}
}

func (e *DevKeygen) device() *libkb.Device {
	s := libkb.DEVICE_STATUS_ACTIVE
	return &libkb.Device{
		Id:          e.args.DeviceID.String(),
		Description: &e.args.DeviceName,
		Type:        libkb.DEVICE_TYPE_DESKTOP,
		Status:      &s,
	}
}
