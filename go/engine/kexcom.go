package engine

import (
	"crypto/hmac"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

// KexCom contains common functions for all kex engines.  It
// should be embedded in the kex engines.
type KexCom struct {
	server             kex.Handler
	user               libkb.User
	deviceID           libkb.DeviceID
	deviceSibkey       libkb.GenericKey
	sigKey             libkb.GenericKey
	sessionID          kex.StrongID
	startKexReceived   chan bool
	helloReceived      chan bool
	pleaseSignReceived chan bool
	doneReceived       chan bool
	debugName          string
	xDevKeyID          libkb.KID
	lks                *libkb.LKSec
	engctx             *Context // so that kex interface doesn't need to depend on engine ctx
	msgReceiveComplete chan bool
}

func newKexCom(lksClientHalf []byte) *KexCom {
	kc := &KexCom{
		startKexReceived:   make(chan bool, 1),
		helloReceived:      make(chan bool, 1),
		pleaseSignReceived: make(chan bool, 1),
		doneReceived:       make(chan bool, 1),
		msgReceiveComplete: make(chan bool, 1),
	}
	if lksClientHalf != nil {
		kc.lks = libkb.NewLKSecClientHalf(lksClientHalf)
	}
	return kc
}

func (k *KexCom) StartKexSession(m *kex.Meta, id kex.StrongID) error {
	if err := k.verifyReceiver(m); err != nil {
		return err
	}

	if err := k.verifySession(m); err != nil {
		return err
	}

	m.Swap()
	pair, ok := k.deviceSibkey.(libkb.NaclSigningKeyPair)
	if !ok {
		return libkb.BadKeyError{Msg: fmt.Sprintf("invalid device sibkey type %T", k.deviceSibkey)}
	}
	G.Log.Debug("[%s] calling Hello on server (m.Sender = %s, k.deviceID = %s, m.Receiver = %s)", k.debugName, m.Sender, k.deviceID, m.Receiver)

	k.startKexReceived <- true

	return k.server.Hello(m, m.Sender, pair.GetKid())
}

func (k *KexCom) StartReverseKexSession(m *kex.Meta) error { return nil }

func (k *KexCom) Hello(m *kex.Meta, devID libkb.DeviceID, devKeyID libkb.KID) error {
	G.Log.Debug("[%s] Hello Receive", k.debugName)
	defer G.Log.Debug("[%s] Hello Receive done", k.debugName)
	if err := k.verifyRequest(m); err != nil {
		return err
	}

	k.xDevKeyID = devKeyID

	k.helloReceived <- true
	return nil
}

// sig is the reverse sig.
func (k *KexCom) PleaseSign(m *kex.Meta, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	G.Log.Debug("[%s] PleaseSign Receive", k.debugName)
	defer G.Log.Debug("[%s] PleaseSign Receive done", k.debugName)
	if err := k.verifyRequest(m); err != nil {
		return err
	}

	rs := &libkb.ReverseSig{Sig: sig, Type: "kb"}

	// make device object for Y
	s := libkb.DEVICE_STATUS_ACTIVE
	devY := libkb.Device{
		Id:          m.Sender.String(),
		Type:        devType,
		Description: &devDesc,
		Status:      &s,
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
			Me:        &k.user,
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
		Me:          &k.user,
		Device:      &devY,
		EldestKeyID: k.user.GetEldestFOKID().Kid,
		RevSig:      rs,
		Generator:   g,
	}
	gen := libkb.NewNaclKeyGen(arg)
	if err := gen.Generate(); err != nil {
		return err
	}
	_, err := gen.Push()
	if err != nil {
		return err
	}

	k.pleaseSignReceived <- true

	m.Swap()
	return k.server.Done(m)
}

func (k *KexCom) Done(m *kex.Meta) error {
	G.Log.Debug("[%s] Done Receive", k.debugName)
	defer G.Log.Debug("[%s] Done Receive done", k.debugName)
	if err := k.verifyRequest(m); err != nil {
		return err
	}

	// device X changed the sigchain, so reload the user to get the latest sigchain.
	u, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		return err
	}
	k.user = *u

	k.doneReceived <- true
	return nil
}

func (k *KexCom) verifyReceiver(m *kex.Meta) error {
	G.Log.Debug("kex Meta: sender device %s => receiver device %s", m.Sender, m.Receiver)
	G.Log.Debug("kex Meta: own device %s", k.deviceID)
	if m.Receiver != k.deviceID {
		return libkb.ErrReceiverDevice
	}
	return nil
}

func (k *KexCom) verifySession(m *kex.Meta) error {
	if !hmac.Equal(m.StrongID[:], k.sessionID[:]) {
		return libkb.ErrInvalidKexSession
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

func (k *KexCom) receive(m *kex.Meta, secret kex.SecretKey) {
	rec := kex.NewReceiver(k, m.Direction, secret)
	for {
		if _, err := rec.Receive(m); err != nil {
			if err == kex.ErrProtocolEOF {
				G.Log.Debug("received EOF in message, stopping receive")
				return
			}
			G.Log.Debug("receive error: %s", err)
		}
		select {
		case <-k.msgReceiveComplete:
			return
		default:
		}
	}
}
