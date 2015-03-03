package engine

import (
	"crypto/hmac"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

// KexCom contains common functions for all kex engines.  It
// should be embedded in the kex engines.
type KexCom struct {
	server    kex.Handler
	user      *libkb.User
	deviceID  libkb.DeviceID
	sessionID kex.StrongID
	debugName string
	wg        sync.WaitGroup
	rec       *kex.Receiver
	libkb.Contextified
}

func newKexCom() *KexCom {
	return &KexCom{}
}

func (k *KexCom) verifyReceiver(m *kex.Meta) error {
	k.G().Log.Debug("[%s] kex Meta: sender device %s => receiver device %s", k.debugName, m.Sender, m.Receiver)
	k.G().Log.Debug("[%s] kex Meta: own device %s", k.debugName, k.deviceID)
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

func (k *KexCom) poll(m *kex.Meta, secret kex.SecretKey) {
	k.rec = kex.NewReceiver(m.Direction, secret)
	k.wg.Add(1)
	go func() {
		k.rec.Poll(m)
		k.wg.Done()
	}()
}

func (k *KexCom) next(name kex.MsgName, timeout time.Duration, handler func(*kex.Msg) error) error {
	k.G().Log.Debug("%s: waiting for %s", k.debugName, name)
	msg, err := k.rec.Next(name, timeout)
	if err != nil {
		return err
	}
	if err := k.verifyRequest(&msg.Meta); err != nil {
		return err
	}
	return handler(msg)
}
