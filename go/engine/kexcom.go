package engine

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	"golang.org/x/crypto/scrypt"
)

// KexCom contains common functions for all kex engines.  It
// should be embedded in the kex engines.
type KexCom struct {
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
}

var kexTimeout = 5 * time.Minute

// XXX temporary...
// this is to get around the fact that the globals won't work well
// in the test with two devices communicating in the same process.
func (k *KexCom) Listen(ctx *Context, u *libkb.User, src libkb.DeviceID) {
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

func (k *KexCom) waitHello() error {
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

func (k *KexCom) waitDone() error {
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

func (k *KexCom) secret() (words []string, id [32]byte, err error) {
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

func (k *KexCom) wordsToID(words string) ([32]byte, error) {
	if k.user == nil {
		return [32]byte{}, fmt.Errorf("nil user")
	}
	key, err := scrypt.Key([]byte(words), []byte(k.user.GetName()), 32768, 8, 1, 32)
	if err != nil {
		return [32]byte{}, err
	}
	return sha256.Sum256(key), nil
}

func (k *KexCom) StartKexSession(m *kex.Meta, id kex.StrongID) error {
	G.Log.Info("[%s] StartKexSession: %x", k.debugName, id)
	defer G.Log.Info("[%s] StartKexSession done", k.debugName)

	if err := k.verifyReceiver(m); err != nil {
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

	if err := k.verifySession(m); err != nil {
		return err
	}

	m.Swap()
	pair, ok := k.deviceSibkey.(libkb.NaclSigningKeyPair)
	if !ok {
		return fmt.Errorf("invalid device sibkey type %T", k.deviceSibkey)
	}
	G.Log.Info("[%s] calling Hello on server (m.Sender = %s, k.deviceID = %s, m.Receiver = %s)", k.debugName, m.Sender, k.deviceID, m.Receiver)
	G.Log.Info("kexcom.StartKexSession: have a server? %v", k.server != nil)
	return k.server.Hello(m, m.Sender, pair.GetKid())
}

func (k *KexCom) StartReverseKexSession(m *kex.Meta) error { return nil }

func (k *KexCom) Hello(m *kex.Meta, devID libkb.DeviceID, devKeyID libkb.KID) error {
	G.Log.Info("[%s] Hello Receive", k.debugName)
	defer G.Log.Info("[%s] Hello Receive done", k.debugName)
	if err := k.verifyRequest(m); err != nil {
		return err
	}

	k.xDevKeyID = devKeyID

	k.helloReceived <- true
	return nil
}

// sig is the reverse sig.
func (k *KexCom) PleaseSign(m *kex.Meta, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	G.Log.Info("[%s] PleaseSign Receive", k.debugName)
	defer G.Log.Info("[%s] PleaseSign Receive done", k.debugName)
	if err := k.verifyRequest(m); err != nil {
		return err
	}

	rs := &libkb.ReverseSig{Sig: sig, Type: "kb"}

	// make device object for Y
	devY := libkb.Device{
		Id:          m.Sender.String(),
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

	m.Swap()
	return k.server.Done(m, mt)
}

func (k *KexCom) Done(m *kex.Meta, mt libkb.MerkleTriple) error {
	G.Log.Info("[%s] Done Receive", k.debugName)
	defer G.Log.Info("[%s] Done Receive done", k.debugName)
	if err := k.verifyRequest(m); err != nil {
		return err
	}

	// device X changed the sigchain, so reload the user to get the latest sigchain.
	var err error
	k.user, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		return err
	}

	k.doneReceived <- true
	return nil
}

func (k *KexCom) RegisterTestDevice(srv kex.Handler, device libkb.DeviceID) error { return nil }

func (k *KexCom) verifyReceiver(m *kex.Meta) error {
	G.Log.Debug("kex Meta: sender device %s => receiver device %s", m.Sender, m.Receiver)
	G.Log.Debug("kex Meta: own device %s", k.deviceID)
	if m.Receiver != k.deviceID {
		return fmt.Errorf("receiver device id (%s) invalid.  this is device (%s).", m.Receiver, k.deviceID)
	}
	return nil
}

func (k *KexCom) verifySession(m *kex.Meta) error {
	if m.StrongID != k.sessionID {
		return fmt.Errorf("%s: Meta StrongID (%x) != sessionID (%x)", k.debugName, m.StrongID, k.sessionID)
	}
	return nil
}

func (k *KexCom) verifyRequest(m *kex.Meta) error {
	if err := k.verifyReceiver(m); err != nil {
		return err
	}
	if err := k.verifySession(m); err != nil {
		return err
	}
	return nil
}

func (k *KexCom) receive(m *kex.Meta, dir kex.Direction) {
	rec := kex.NewReceiver(k, dir)
	for {
		if err := rec.Receive(m); err != nil {
			G.Log.Debug("receive error: %s", err)
		}
	}
}
