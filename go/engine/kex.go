package engine

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase_1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/crypto/scrypt"
)

type Kex struct {
	server        kex.Handler
	user          *libkb.User
	deviceID      libkb.DeviceID
	deviceSibkey  libkb.GenericKey
	sigKey        libkb.GenericKey
	sessionID     kex.StrongID
	helloReceived chan bool
	doneReceived  chan bool
	debugName     string
	xDevKeyID     libkb.KID
	lks           *libkb.LKSec
	getSecret     func() string // testing only
	engctx        *Context      // so that kex interface doesn't need to depend on engine ctx
	glob          *libkb.Global
}

var kexTimeout = 5 * time.Minute

func NewKex(server kex.Handler, lksCli []byte, options ...func(*Kex)) *Kex {
	k := &Kex{server: server, helloReceived: make(chan bool, 1), doneReceived: make(chan bool, 1)}
	k.lks = libkb.NewLKSecClientHalf(lksCli)
	for _, opt := range options {
		opt(k)
	}
	return k
}

func SetDebugName(name string) func(k *Kex) {
	return func(k *Kex) {
		k.debugName = name
	}
}

type FwdArgs struct {
	User    *libkb.User
	Src     libkb.DeviceID
	Dst     libkb.DeviceID
	DevType string
	DevDesc string
}

func (k *Kex) Run(ctx *Context, args, reply interface{}) error {
	k.engctx = ctx
	fargs, ok := args.(FwdArgs)
	if !ok {
		return fmt.Errorf("invalid args type: %T", args)
	}
	return k.StartForward(ctx, fargs.User, fargs.Src, fargs.Dst, fargs.DevType, fargs.DevDesc)
}

// secret is needed before this can start because receive needs
// the weak id, which is based on the strong id, which comes from
// the secret.
func (k *Kex) StartAccept(ectx *Context, u *libkb.User, dev libkb.DeviceID, secret string, g *libkb.Global) error {
	g.Log.Info("kex engine: StartAccept (%s)", secret)
	k.user = u
	k.deviceID = dev
	k.engctx = ectx
	k.glob = g

	var err error
	k.deviceSibkey, err = k.user.GetComputedKeyFamily().GetSibkeyForDevice(dev)
	if err != nil {
		g.Log.Warning("StartAccept: error getting device sibkey: %s", err)
		return err
	}
	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Reason:    "new device install",
		Ui:        ectx.SecretUI,
		Me:        k.user,
		DeviceID:  &k.deviceID,
	}
	k.sigKey, err = g.Keyrings.GetSecretKey(arg)
	if err != nil {
		g.Log.Warning("GetSecretKey error: %s", err)
		//return err
	}

	id, err := k.wordsToID(secret)
	if err != nil {
		return err
	}
	k.sessionID = id

	ctx := &kex.Context{
		Meta: kex.Meta{
			UID:      k.user.GetUid(),
			Receiver: dev,
			StrongID: id,
		},
	}
	copy(ctx.WeakID[:], id[0:16])

	k.receive(ctx, kex.DirectionYtoX)
	return nil
}

// StartForward starts the forward version of kex device
// provisioning.
//
// It should be called on the new device, device Y.
// src = device id of device Y
// dst = device id of device X (the existing device that will sign
// it)
func (k *Kex) StartForward(ectx *Context, u *libkb.User, src, dst libkb.DeviceID, devType, devDesc string) error {
	k.user = u
	k.deviceID = src
	k.engctx = ectx

	// XXX this is just for testing
	k.server.RegisterTestDevice(k, src)

	// make random secret S
	words, id, err := k.secret()
	if err != nil {
		return err
	}

	k.sessionID = id

	ctx := &kex.Context{
		Meta: kex.Meta{
			UID:      k.user.GetUid(),
			StrongID: id,
			Sender:   src,
			Receiver: dst,
		},
	}
	copy(ctx.WeakID[:], id[0:16])

	go k.receive(ctx, kex.DirectionXtoY)

	// tell user the command to enter on existing device (X)
	// note: this has to happen before StartKexSession call for tests to work.
	if err := ectx.DoctorUI.DisplaySecretWords(keybase_1.DisplaySecretWordsArg{XDevDescription: devDesc, Secret: strings.Join(words, " ")}); err != nil {
		return err
	}

	if err := k.server.StartKexSession(ctx, id); err != nil {
		return err
	}

	// wait for Hello() from X
	if err := k.waitHello(); err != nil {
		return err
	}

	// E_y
	eddsa, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		return err
	}
	eddsaPair, ok := eddsa.(libkb.NaclSigningKeyPair)
	if !ok {
		return fmt.Errorf("invalid key type %T", eddsa)
	}

	// M_y
	dh, err := libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return err
	}

	// store E_y, M_y in lks
	if _, err := libkb.WriteLksSKBToKeyring(k.user.GetName(), eddsa, k.lks, ectx.LogUI); err != nil {
		return err
	}
	if _, err := libkb.WriteLksSKBToKeyring(k.user.GetName(), dh, k.lks, ectx.LogUI); err != nil {
		return err
	}

	// The signature sent to PleaseSign is a reverse sig
	// of X's dev key id.
	rsp := libkb.ReverseSigPayload{k.xDevKeyID.String()}
	sig, _, _, err := libkb.SignJson(jsonw.NewWrapper(rsp), eddsa)
	if err != nil {
		return err
	}

	ctx.Sender = src
	ctx.Receiver = dst
	if err := k.server.PleaseSign(ctx, eddsaPair.Public, sig, devType, devDesc); err != nil {
		return err
	}

	// wait for Done() from X
	if err := k.waitDone(); err != nil {
		return err
	}

	// Device y signs M_y into Alice's sigchain as a subkey.
	devY := libkb.Device{
		Id:          k.deviceID.String(),
		Type:        devType,
		Description: &devDesc,
	}
	g := func() (libkb.NaclKeyPair, error) {
		return dh, nil
	}
	arg := libkb.NaclKeyGenArg{
		Signer:      eddsa,
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

	// store the new device id
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

// XXX temporary...
// this is to get around the fact that the globals won't work well
// in the test with two devices communicating in the same process.
func (k *Kex) Listen(ctx *Context, u *libkb.User, src libkb.DeviceID) {
	k.user = u
	k.deviceID = src
	var err error
	k.deviceSibkey, err = k.user.GetComputedKeyFamily().GetSibkeyForDevice(src)
	if err != nil {
		G.Log.Warning("kex.Listen: error getting device sibkey: %s", err)
	}
	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Reason:    "new device install",
		Ui:        ctx.SecretUI,
		Me:        k.user,
	}
	k.sigKey, err = G.Keyrings.GetSecretKey(arg)
	if err != nil {
		G.Log.Warning("GetSecretKey error: %s", err)
	}
}

func (k *Kex) waitHello() error {
	G.Log.Info("[%s] waitHello start", k.debugName)
	defer G.Log.Info("[%s] waitHello done", k.debugName)
	select {
	case <-k.helloReceived:
		G.Log.Info("[%s] hello received", k.debugName)
		return nil
	case <-time.After(kexTimeout):
		return fmt.Errorf("timeout waiting for Hello")
	}
}

func (k *Kex) waitDone() error {
	G.Log.Info("[%s] waitDone start", k.debugName)
	defer G.Log.Info("[%s] waitDone done", k.debugName)
	select {
	case <-k.doneReceived:
		G.Log.Info("[%s] done received", k.debugName)
		return nil
	case <-time.After(kexTimeout):
		return fmt.Errorf("timeout waiting for Done")
	}
}

func (k *Kex) secret() (words []string, id [32]byte, err error) {
	words, err = libkb.SecWordList(5)
	if err != nil {
		return
	}
	id, err = k.wordsToID(strings.Join(words, " "))
	if err != nil {
		return
	}

	return words, id, err
}

func (k *Kex) wordsToID(words string) ([32]byte, error) {
	key, err := scrypt.Key([]byte(words), []byte(k.user.GetName()), 32768, 8, 1, 32)
	if err != nil {
		return [32]byte{}, err
	}
	return sha256.Sum256(key), nil
}

func (k *Kex) StartKexSession(ctx *kex.Context, id kex.StrongID) error {
	G.Log.Info("[%s] StartKexSession: %x", k.debugName, id)
	defer G.Log.Info("[%s] StartKexSession done", k.debugName)

	if err := k.verifyReceiver(ctx); err != nil {
		return err
	}

	// generate secret
	if k.getSecret != nil {
		// this is for testing.
		words := k.getSecret()
		G.Log.Info("[%s] secret: %q", k.debugName, words)
		id, err := k.wordsToID(words)
		if err != nil {
			return err
		}
		k.sessionID = id
	}

	if err := k.verifySession(ctx); err != nil {
		return err
	}

	ctx.Swap()
	pair, ok := k.deviceSibkey.(libkb.NaclSigningKeyPair)
	if !ok {
		return fmt.Errorf("invalid device sibkey type %T", k.deviceSibkey)
	}
	G.Log.Info("[%s] calling Hello on server (ctx.Sender = %s, k.deviceID = %s, ctx.Receiver = %s)", k.debugName, ctx.Sender, k.deviceID, ctx.Receiver)
	return k.server.Hello(ctx, ctx.Sender, pair.GetKid())
}

func (k *Kex) StartReverseKexSession(ctx *kex.Context) error { return nil }

func (k *Kex) Hello(ctx *kex.Context, devID libkb.DeviceID, devKeyID libkb.KID) error {
	G.Log.Info("[%s] Hello Receive", k.debugName)
	defer G.Log.Info("[%s] Hello Receive done", k.debugName)
	if err := k.verifyRequest(ctx); err != nil {
		return err
	}

	k.xDevKeyID = devKeyID

	k.helloReceived <- true
	return nil
}

// sig is the reverse sig.
func (k *Kex) PleaseSign(ctx *kex.Context, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	G.Log.Info("[%s] PleaseSign Receive", k.debugName)
	defer G.Log.Info("[%s] PleaseSign Receive done", k.debugName)
	if err := k.verifyRequest(ctx); err != nil {
		return err
	}

	rs := &libkb.ReverseSig{Sig: sig, Type: "kb"}

	// make device object for Y
	devY := libkb.Device{
		Id:          ctx.Sender.String(),
		Type:        devType,
		Description: &devDesc,
	}

	// generator function that just copies the public eddsa key into a
	// NaclKeyPair (which implements GenericKey).
	g := func() (libkb.NaclKeyPair, error) {
		var ret libkb.NaclSigningKeyPair
		copy(ret.Public[:], eddsa[:])
		return ret, nil
	}

	// need the private device sibkey
	// k.deviceSibkey is public only
	if k.sigKey == nil {
		var err error
		arg := libkb.SecretKeyArg{
			DeviceKey: true,
			Reason:    "new device install",
			Ui:        k.engctx.SecretUI,
			Me:        k.user,
			DeviceID:  &k.deviceID,
		}
		G.Log.Warning("G value: %v", G)
		G.Log.Warning("glob value: %v", k.glob)
		G.Log.Warning("G.Env.GetDeviceID(): %s", G.Env.GetDeviceID())
		G.Log.Warning("glob.Env.GetDeviceID(): %s", k.glob.Env.GetDeviceID())
		if G.Env.GetDeviceID() == nil {
			G.Log.Warning("setting G to k.glob")
			//			prevG := G
			G = k.glob
			//			defer func() { G = prevG }()
			G.Log.Warning("Now: G.Env.GetDeviceID(): %s", G.Env.GetDeviceID())
		}
		k.sigKey, err = G.Keyrings.GetSecretKey(arg)
		if err != nil {
			return err
		}
	}

	// use naclkeygen to sign eddsa with device X (this device) sibkey
	// and push it to the server
	arg := libkb.NaclKeyGenArg{
		Signer:      k.sigKey,
		ExpireIn:    libkb.NACL_EDDSA_EXPIRE_IN,
		Sibkey:      true,
		Me:          k.user,
		Device:      &devY,
		EldestKeyID: k.user.GetEldestFOKID().Kid,
		RevSig:      rs,
		Generator:   g,
	}
	gen := libkb.NewNaclKeyGen(arg)
	if err := gen.Generate(); err != nil {
		return fmt.Errorf("gen.Generate() error: %s", err)
	}
	mt, err := gen.Push()
	if err != nil {
		return fmt.Errorf("gen.Push() error: %s", err)
	}

	ctx.Swap()
	return k.server.Done(ctx, mt)
}

func (k *Kex) Done(ctx *kex.Context, mt libkb.MerkleTriple) error {
	G.Log.Info("[%s] Done Receive", k.debugName)
	defer G.Log.Info("[%s] Done Receive done", k.debugName)
	if err := k.verifyRequest(ctx); err != nil {
		return err
	}

	// device X changed the sigchain, so bump it here
	k.user.SigChainBumpMT(mt)

	k.doneReceived <- true
	return nil
}

func (k *Kex) RegisterTestDevice(srv kex.Handler, device libkb.DeviceID) error { return nil }

func (k *Kex) verifyReceiver(ctx *kex.Context) error {
	G.Log.Debug("kex context: sender device %s => receiver device %s", ctx.Sender, ctx.Receiver)
	G.Log.Debug("kex context: own device %s", k.deviceID)
	if ctx.Receiver != k.deviceID {
		return fmt.Errorf("receiver device id (%s) invalid.  this is device (%s).", ctx.Receiver, k.deviceID)
	}
	return nil
}

func (k *Kex) verifySession(ctx *kex.Context) error {
	if ctx.StrongID != k.sessionID {
		return fmt.Errorf("%s: context StrongID (%x) != sessionID (%x)", k.debugName, ctx.StrongID, k.sessionID)
	}
	return nil
}

func (k *Kex) verifyRequest(ctx *kex.Context) error {
	if err := k.verifyReceiver(ctx); err != nil {
		return err
	}
	if err := k.verifySession(ctx); err != nil {
		return err
	}
	return nil
}

func (k *Kex) receive(ctx *kex.Context, dir kex.Direction) {
	rec := kex.NewReceiver(k, dir)
	for {
		if err := rec.Receive(ctx); err != nil {
			G.Log.Info("receive error: %s", err)
		}
	}
}
