package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase1 "github.com/keybase/client/protocol/go"
)

// KexCom contains common functions for all kex engines.  It
// should be embedded in the kex engines.
type KexCom struct {
	libkb.Contextified
	user      *libkb.User
	deviceID  keybase1.DeviceID
	debugName string
	wg        sync.WaitGroup
	recMu     sync.Mutex
	rec       *kex.Receiver
	serverMu  sync.Mutex
	server    kex.Handler
}

func newKexCom(gc *libkb.GlobalContext) *KexCom {
	return &KexCom{Contextified: libkb.NewContextified(gc)}
}

func (k *KexCom) verifyReceiver(m *kex.Meta) error {
	k.G().Log.Debug("[%s] kex Meta: sender device %s => receiver device %s", k.debugName, m.Sender, m.Receiver)
	k.G().Log.Debug("[%s] kex Meta: own device %s", k.debugName, k.deviceID)
	if m.Receiver != k.deviceID {
		return libkb.NewReceiverDeviceError(k.deviceID, m.Receiver)
	}
	return nil
}

func (k *KexCom) verifyRequest(m *kex.Meta) error {
	if err := k.verifyReceiver(m); err != nil {
		return err
	}
	return nil
}

func (k *KexCom) sessionArgs(ctx *Context) (token, csrf string) {
	if ctx.LoginContext != nil {
		token, csrf = ctx.LoginContext.LocalSession().APIArgs()
	} else {
		err := k.G().LoginState().LocalSession(func(s *libkb.Session) {
			token, csrf = s.APIArgs()
		}, "kexcom - APIArgs")
		if err != nil {
			k.G().Log.Warning("error getting LocalSession: %s", err)
		}
	}
	return
}

func (k *KexCom) poll(ctx *Context, m *kex.Meta, secret *kex.Secret) {
	token, csrf := k.sessionArgs(ctx)
	k.recMu.Lock()
	k.rec = kex.NewReceiver(m.Direction, secret, token, csrf, k.G())
	k.recMu.Unlock()
	k.wg.Add(1)
	go func() {
		k.rec.Poll(m)
		k.wg.Done()
	}()
}

func (k *KexCom) next(ctx *Context, name kex.MsgName, timeout time.Duration, handler func(*Context, *kex.Msg) error) error {
	k.G().Log.Debug("%s: waiting for %s (%s)", k.debugName, name, timeout)
	msg, err := k.rec.Next(name, timeout)
	k.G().Log.Debug("%s: got message %s", k.debugName, name)
	if err != nil {
		k.G().Log.Warning("%s: receiving Kex message %s gave error: %s", k.debugName, name, err)
		return err
	}
	if err := k.verifyRequest(&msg.Meta); err != nil {
		k.G().Log.Warning("%s: verifying Kex message %s gave error: %s", k.debugName, name, err)
		return err
	}
	k.G().Log.Debug("%s: dispatching message to handler: %s", k.debugName, name)
	return handler(ctx, msg)
}

func (k *KexCom) kexStatus(ctx *Context, msg string, code keybase1.KexStatusCode) {
	// just to be sure...
	if ctx.LocksmithUI == nil {
		k.G().Log.Warning("KexCom kexStatus(), ctx.LocksmithUI is nil")
		return
	}

	if err := ctx.LocksmithUI.KexStatus(keybase1.KexStatusArg{Msg: msg, Code: code}); err != nil {
		// an error here isn't critical
		k.G().Log.Debug("send KexStatus error: %s", err)
	}
}

func (k *KexCom) cancel(m *kex.Meta) error {
	k.recMu.Lock()
	defer k.recMu.Unlock()
	if k.rec != nil {
		if err := k.rec.Cancel(); err != nil {
			return err
		}
	}
	k.serverMu.Lock()
	defer k.serverMu.Unlock()
	if k.server != nil {
		if err := k.server.Cancel(m); err != nil {
			return err
		}
	}
	return nil
}
