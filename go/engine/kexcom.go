package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase_1 "github.com/keybase/client/protocol/go"
)

// KexCom contains common functions for all kex engines.  It
// should be embedded in the kex engines.
type KexCom struct {
	server    kex.Handler
	user      *libkb.User
	deviceID  libkb.DeviceID
	debugName string
	wg        sync.WaitGroup
	rec       *kex.Receiver
	libkb.Contextified
}

func newKexCom(gc *libkb.GlobalContext) *KexCom {
	return &KexCom{Contextified: libkb.NewContextified(gc)}
}

func (k *KexCom) verifyReceiver(m *kex.Meta) error {
	k.G().Log.Debug("[%s] kex Meta: sender device %s => receiver device %s", k.debugName, m.Sender, m.Receiver)
	k.G().Log.Debug("[%s] kex Meta: own device %s", k.debugName, k.deviceID)
	if m.Receiver != k.deviceID {
		return libkb.ErrReceiverDevice
	}
	return nil
}

func (k *KexCom) verifyRequest(m *kex.Meta) error {
	if err := k.verifyReceiver(m); err != nil {
		return err
	}
	return nil
}

func (k *KexCom) poll(m *kex.Meta, secret *kex.Secret) {
	k.rec = kex.NewReceiver(m.Direction, secret)
	k.wg.Add(1)
	go func() {
		k.rec.Poll(m)
		k.wg.Done()
	}()
}

func (k *KexCom) next(name kex.MsgName, timeout time.Duration, handler func(*kex.Msg) error) error {
	k.G().Log.Debug("%s: waiting for %s (%s)", k.debugName, name, timeout)
	msg, err := k.rec.Next(name, timeout)
	k.G().Log.Debug("%s: got message %s", k.debugName, name)
	if err != nil {
		k.G().Log.Warning("%s: receiving Kex message %s gave error: %s", k.debugName, name, err.Error())
		return err
	}
	if err := k.verifyRequest(&msg.Meta); err != nil {
		k.G().Log.Warning("%s: verifying Kex message %s gave error: %s", k.debugName, name, err.Error())
		return err
	}
	k.G().Log.Debug("%s: dispatching message to handler: %s", k.debugName, name)
	return handler(msg)
}

func (k *KexCom) kexStatus(ctx *Context, msg string, code keybase_1.KexStatusCode) {
	if err := ctx.DoctorUI.KexStatus(keybase_1.KexStatusArg{Msg: msg, Code: code}); err != nil {
		// an error here isn't critical
		k.G().Log.Debug("send KexStatus error: %s", err)
	}
}
