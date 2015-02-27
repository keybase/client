package engine

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase_1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

// KexFwd is an engine for running the Device Key Exchange
// Protocol, forward version.  It should be called on the new
// device (referred to as device Y in comments).
type KexFwd struct {
	KexCom
	args *KexFwdArgs
}

type KexFwdArgs struct {
	User    *libkb.User    // the user who owns device Y and device X
	Src     libkb.DeviceID // device ID of this new device (device Y)
	Dst     libkb.DeviceID // device ID of existing provisioned device (device X)
	DevType string         // type of this new device (e.g. desktop, mobile)
	DevDesc string         // description of this new device
}

// NewKexFwd creates a KexFwd engine.
func NewKexFwd(server kex.Handler, lksClientHalf []byte, args *KexFwdArgs, options ...func(*KexFwd)) *KexFwd {
	kc := newKexCom(server, lksClientHalf)
	kf := &KexFwd{KexCom: *kc, args: args}

	for _, opt := range options {
		opt(kf)
	}

	return kf
}

func (k *KexFwd) Name() string {
	return "KexFwd"
}

func (k *KexFwd) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

func (k *KexFwd) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.DoctorUIKind, libkb.LogUIKind}
}

func (k *KexFwd) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (k *KexFwd) Run(ctx *Context, args, reply interface{}) error {
	k.user = k.args.User
	k.deviceID = k.args.Src
	k.engctx = ctx
	k.helloReceived = make(chan bool, 1)
	k.doneReceived = make(chan bool, 1)

	// make random secret S
	words, err := k.makeSecret()
	if err != nil {
		return err
	}

	// create the kex meta data
	m := kex.NewMeta(k.args.User.GetUid(), k.sessionID, k.args.Src, k.args.Dst, kex.DirectionXtoY)

	// start message receive loop
	go k.receive(m, kex.DirectionXtoY)

	// tell user the command to enter on existing device (X)
	// note: this has to happen before StartKexSession call for tests to work.
	if err := ctx.DoctorUI.DisplaySecretWords(keybase_1.DisplaySecretWordsArg{XDevDescription: k.args.DevDesc, Secret: words}); err != nil {
		return err
	}

	// start the kex session with X
	if err := k.server.StartKexSession(m, k.sessionID); err != nil {
		return err
	}

	// wait for Hello() from X
	if err := k.waitHello(); err != nil {
		return err
	}

	// make keys for device Y
	keys, err := k.makeKeys()
	if err != nil {
		return err
	}

	// store the keys in lks
	if err := k.storeKeys(ctx, keys); err != nil {
		return err
	}

	// get the signing key
	signer, err := keys.signer()
	if err != nil {
		return err
	}

	// get reverse signature of X's device key
	rsig, err := k.revSig(keys.eddsa)
	if err != nil {
		return err
	}

	// send PleaseSign message to X
	m.Sender = k.args.Src
	m.Receiver = k.args.Dst
	if err := k.server.PleaseSign(m, signer, rsig, k.args.DevType, k.args.DevDesc); err != nil {
		return err
	}

	// wait for Done() from X
	if err := k.waitDone(); err != nil {
		return err
	}

	k.msgReceiveComplete <- true

	// push the dh key as a subkey to the server
	if err := k.pushSubkey(keys); err != nil {
		return err
	}

	// store the new device id
	return k.storeDeviceID()
}

// makeSecret generates a random secret (S in doc).  It sets
// sessionID to the value and returns the phrase that generated
// the secret.
func (k *KexFwd) makeSecret() (string, error) {
	words, id, err := k.secret()
	if err != nil {
		return "", err
	}
	k.sessionID = id
	return strings.Join(words, " "), nil
}

type keyres struct {
	eddsa libkb.NaclKeyPair
	dh    libkb.NaclKeyPair
}

// signer returns the public signing key.
func (k keyres) signer() (pub libkb.NaclSigningKeyPublic, err error) {
	s, ok := k.eddsa.(libkb.NaclSigningKeyPair)
	if !ok {
		return pub, fmt.Errorf("invalid key type %T", k.eddsa)
	}
	return s.Public, nil
}

// makeKeys generates E_y, M_y for this device.  It returns
// keyres, which contains the eddsa signing key and the dh encryption
// key.
func (k *KexFwd) makeKeys() (*keyres, error) {
	res := &keyres{}

	// E_y
	eddsa, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		return nil, err
	}
	res.eddsa = eddsa

	// M_y
	dh, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return nil, err
	}
	res.dh = dh
	return res, nil
}

// storeKeys stores E_y, M_y in lks.
func (k *KexFwd) storeKeys(ctx *Context, keys *keyres) error {
	if _, err := libkb.WriteLksSKBToKeyring(k.user.GetName(), keys.eddsa, k.lks, ctx.LogUI); err != nil {
		return err
	}
	if _, err := libkb.WriteLksSKBToKeyring(k.user.GetName(), keys.dh, k.lks, ctx.LogUI); err != nil {
		return err
	}
	return nil
}

// revSig generates a reverse signature using X's device key id.
func (k *KexFwd) revSig(eddsa libkb.NaclKeyPair) (string, error) {
	rsp := libkb.ReverseSigPayload{k.xDevKeyID.String()}
	sig, _, _, err := libkb.SignJson(jsonw.NewWrapper(rsp), eddsa)
	if err != nil {
		return "", err
	}
	return sig, nil
}

// pushSubkey pushes Y's subkey to the api server.
func (k *KexFwd) pushSubkey(keys *keyres) error {
	// Device y signs M_y into Alice's sigchain as a subkey.
	s := libkb.DEVICE_STATUS_ACTIVE
	devY := libkb.Device{
		Id:          k.deviceID.String(),
		Type:        k.args.DevType,
		Description: &k.args.DevDesc,
		Status:      &s,
	}
	g := func() (libkb.NaclKeyPair, error) {
		return keys.dh, nil
	}
	arg := libkb.NaclKeyGenArg{
		Signer:      keys.eddsa,
		ExpireIn:    libkb.NACL_DH_EXPIRE_IN,
		Sibkey:      false,
		Me:          k.user,
		EldestKeyID: k.user.GetEldestFOKID().Kid,
		Generator:   g,
		Device:      &devY,
	}
	gen := libkb.NewNaclKeyGen(arg)
	if err := gen.Generate(); err != nil {
		return fmt.Errorf("gen.Generate() error: %s", err)
	}
	if _, err := gen.Push(); err != nil {
		return fmt.Errorf("gen.Push() error: %s", err)
	}
	return nil
}

// storeDeviceID stores Y's new device id to config file.
func (k *KexFwd) storeDeviceID() error {
	if wr := G.Env.GetConfigWriter(); wr != nil {
		if err := wr.SetDeviceID(&k.deviceID); err != nil {
			return err
		} else if err := wr.Write(); err != nil {
			return err
		} else {
			G.Log.Info("Setting Device ID to %s", k.deviceID)
		}
	}
	return nil
}
