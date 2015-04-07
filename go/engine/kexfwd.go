package engine

import (
	"fmt"

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
	args      *KexFwdArgs
	secret    *kex.Secret
	lks       *libkb.LKSec
	xDevKeyID libkb.KID
}

type KexFwdArgs struct {
	User    *libkb.User    // the user who owns device Y and device X
	DevType string         // type of this new device Y (e.g. desktop, mobile)
	DevDesc string         // description of this new device Y
	Dst     libkb.DeviceID // device ID of existing provisioned device (device X)
	DstName string         // device name of the existing provisioned device (device X)
}

// NewKexFwd creates a KexFwd engine.
func NewKexFwd(lksClientHalf []byte, args *KexFwdArgs, gc *libkb.GlobalContext) *KexFwd {
	kc := newKexCom(gc)
	kf := &KexFwd{KexCom: *kc, args: args}
	kf.debugName = "KexFwd"
	if lksClientHalf != nil {
		kf.lks = libkb.NewLKSec(lksClientHalf, gc)
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
	return []libkb.UIConsumer{&DeviceRegister{}}
}

// Run starts the engine.
func (k *KexFwd) Run(ctx *Context) error {
	k.SetGlobalContext(ctx.GlobalContext)

	k.G().Log.Debug("KexFwd: run starting")
	defer k.G().Log.Debug("KexFwd: run finished")
	k.user = k.args.User

	// register a new device
	ndarg := &DeviceRegisterArgs{
		Me:   k.user,
		Name: k.args.DevDesc,
		Lks:  k.lks,
	}
	devreg := NewDeviceRegister(ndarg)
	if err := RunEngine(devreg, ctx); err != nil {
		return err
	}
	k.deviceID = devreg.DeviceID()

	// make random secret S, session id I
	sec, err := kex.NewSecret(k.user.GetName())
	if err != nil {
		return err
	}
	k.secret = sec
	k.server = kex.NewSender(kex.DirectionYtoX, k.secret.Secret())

	// create the kex meta data
	m := kex.NewMeta(k.args.User.GetUid(), k.secret.StrongID(), k.deviceID, k.args.Dst, kex.DirectionXtoY)

	// start message receive loop
	k.poll(m, sec)

	done := make(chan bool)
	defer close(done)
	go libkb.TrapKeypress(done)

	// tell user the command to enter on existing device (X)
	// note: this has to happen before StartKexSession call for tests to work.
	k.G().Log.Debug("KexFwd: displaying sibkey command")
	darg := keybase_1.DisplaySecretWordsArg{
		DeviceNameToAdd:    k.args.DevDesc,
		DeviceNameExisting: k.args.DstName,
		Secret:             sec.Phrase(),
	}
	if err := ctx.DoctorUI.DisplaySecretWords(darg); err != nil {
		return err
	}

	// start the kex session with X
	k.G().Log.Debug("KexFwd: sending StartKexSession to X")
	if err := k.server.StartKexSession(m, k.secret.StrongID()); err != nil {
		return err
	}

	// wait for Hello() from X
	if err := k.next(kex.HelloMsg, kex.StartTimeout, k.handleHello); err != nil {
		return err
	}

	dkargs := &DeviceKeygenArgs{
		Me:         k.user,
		DeviceID:   k.deviceID,
		DeviceName: k.args.DevDesc,
		Lks:        k.lks,
	}
	dkeng := NewDeviceKeygen(dkargs)
	if err := RunEngine(dkeng, ctx); err != nil {
		return err
	}

	signerPub, err := dkeng.SigningKeyPublic()
	if err != nil {
		return err
	}

	// get reverse signature of X's device key
	rsig, err := k.revSig(dkeng.SigningKey())
	if err != nil {
		return err
	}

	// send PleaseSign message to X
	m.Sender = k.deviceID
	m.Receiver = k.args.Dst
	k.G().Log.Debug("KexFwd: sending PleaseSign to X")
	if err := k.server.PleaseSign(m, signerPub, rsig, k.args.DevType, k.args.DevDesc); err != nil {
		return err
	}

	// wait for Done() from X
	if err := k.next(kex.DoneMsg, kex.StartTimeout, k.handleDone); err != nil {
		return err
	}

	// push the dh key as a subkey to the server
	k.G().Log.Debug("KexFwd: pushing subkey")
	pargs := &DeviceKeygenPushArgs{
		SkipSignerPush: true,
		Signer:         dkeng.SigningKey(),
		EldestKID:      k.user.GetEldestFOKID().Kid,
	}
	if err := dkeng.Push(ctx, pargs); err != nil {
		return err
	}

	k.wg.Wait()
	return nil
}

func (k *KexFwd) handleHello(m *kex.Msg) error {
	k.xDevKeyID = m.Args().DevKeyID
	return nil
}

func (k *KexFwd) handleDone(m *kex.Msg) error {
	// device X changed the sigchain, so reload the user to get the latest sigchain.
	var err error
	k.user, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		return err
	}
	return nil
}

type keyres struct {
	eddsa libkb.NaclKeyPair
	dh    libkb.NaclKeyPair
}

// signer returns the public signing key.
func (k keyres) signer() (pub libkb.NaclSigningKeyPublic, err error) {
	s, ok := k.eddsa.(libkb.NaclSigningKeyPair)
	if !ok {
		return pub, libkb.BadKeyError{Msg: fmt.Sprintf("invalid key type %T", k.eddsa)}
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
func (k *KexFwd) revSig(eddsa libkb.NaclKeyPair) (sig string, err error) {
	delg := libkb.Delegator{
		ExistingFOKID: &libkb.FOKID{Kid: k.xDevKeyID},
		NewKey:        eddsa,
		Me:            k.args.User,
		Sibkey:        true,
		Expire:        libkb.NACL_EDDSA_EXPIRE_IN,
		Device:        k.GetDevice(),
	}
	var jw *jsonw.Wrapper
	if jw, _, err = k.args.User.KeyProof(delg); err != nil {
		return
	}
	sig, _, _, err = libkb.SignJson(jw, eddsa)
	return
}

func (k *KexFwd) GetDevice() *libkb.Device {
	s := libkb.DEVICE_STATUS_ACTIVE
	return &libkb.Device{
		Id:          k.deviceID.String(),
		Type:        k.args.DevType,
		Description: &k.args.DevDesc,
		Status:      &s,
	}
}

// pushSubkey pushes Y's subkey to the api server.
func (k *KexFwd) pushSubkey(keys *keyres) error {
	// Device y signs M_y into Alice's sigchain as a subkey.
	devY := k.GetDevice()

	g := func() (libkb.NaclKeyPair, error) {
		return keys.dh, nil
	}
	arg := &libkb.NaclKeyGenArg{
		Signer:      keys.eddsa,
		ExpireIn:    libkb.NACL_DH_EXPIRE_IN,
		Sibkey:      false,
		Me:          k.user,
		EldestKeyID: k.user.GetEldestFOKID().Kid,
		Generator:   g,
		Device:      devY,
	}
	gen := libkb.NewNaclKeyGen(arg)
	if err := gen.Generate(); err != nil {
		return err
	}
	if _, err := gen.Push(); err != nil {
		return err
	}
	return nil
}
