package engine

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"time"

	"github.com/keybase/go/libkb"
	"golang.org/x/crypto/scrypt"
)

type KexStrongID [32]byte

type KexContext struct {
	UserID   libkb.UID
	WeakID   int64
	StrongID KexStrongID
	Src      libkb.DeviceID
	Dst      libkb.DeviceID
}

func (c *KexContext) Swap() {
	c.Src, c.Dst = c.Dst, c.Src
}

type KexServer interface {
	StartKexSession(ctx *KexContext, id KexStrongID) error
	StartReverseKexSession(ctx *KexContext) error
	Hello(ctx *KexContext) error
	PleaseSign(ctx *KexContext) error
	Done(ctx *KexContext) error

	// XXX get rid of this when real client comm works
	RegisterTestDevice(srv KexServer, device libkb.DeviceID) error
}

type Kex struct {
	server        KexServer
	user          *libkb.User
	deviceID      libkb.DeviceID
	sessionID     KexStrongID
	helloReceived chan bool
	doneReceived  chan bool
	debugName     string
}

var kexTimeout = 5 * time.Minute

func NewKex(s KexServer, options ...func(*Kex)) *Kex {
	k := &Kex{server: s, helloReceived: make(chan bool, 1), doneReceived: make(chan bool, 1)}
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

func (k *Kex) StartForward(u *libkb.User, src, dst libkb.DeviceID) error {
	k.user = u
	k.deviceID = src

	// XXX this is just for testing
	k.server.RegisterTestDevice(k, src)

	// make random secret S
	words, id, err := k.secret()
	if err != nil {
		return err
	}
	G.Log.Info("kex [%s]: words = %v, id = %x", k.debugName, words, id)

	k.sessionID = id

	ctx := &KexContext{
		UserID:   k.user.GetUid(),
		StrongID: id,
		Src:      src,
		Dst:      dst,
	}

	G.Log.Info("StartForward initial context: src = %s, dst = %s", ctx.Src, ctx.Dst)

	if err := k.server.StartKexSession(ctx, id); err != nil {
		return err
	}

	// tell user the command to enter on existing device (X)

	// wait for Hello() from X
	if err := k.waitHello(); err != nil {
		return err
	}

	ctx.Src = src
	ctx.Dst = dst
	G.Log.Info("StartForward PleaseSign context: src = %s, dst = %s", ctx.Src, ctx.Dst)
	if err := k.server.PleaseSign(ctx); err != nil {
		return err
	}

	// wait for Done() from X
	if err := k.waitDone(); err != nil {
		return err
	}

	return nil
}

// XXX temporary...
func (k *Kex) Listen(u *libkb.User, src libkb.DeviceID) {
	k.user = u
	k.deviceID = src
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
	id, err = k.wordsToID(words)
	if err != nil {
		return
	}

	return words, id, err
}

func (k *Kex) wordsToID(words []string) ([32]byte, error) {
	key, err := scrypt.Key([]byte(strings.Join(words, " ")), []byte(k.user.GetName()), 32768, 8, 1, 32)
	if err != nil {
		return [32]byte{}, err
	}
	return sha256.Sum256(key), nil
}

func (k *Kex) StartKexSession(ctx *KexContext, id KexStrongID) error {
	G.Log.Info("[%s] StartKexSession: %x, %v", k.debugName, id, ctx)
	defer G.Log.Info("[%s] StartKexSession done", k.debugName)

	if err := k.verifyDst(ctx); err != nil {
		return err
	}

	ctx.Swap()

	return k.server.Hello(ctx)
}

func (k *Kex) StartReverseKexSession(ctx *KexContext) error { return nil }

func (k *Kex) Hello(ctx *KexContext) error {
	G.Log.Info("[%s] Hello Receive", k.debugName)
	defer G.Log.Info("[%s] Hello Receive done", k.debugName)
	if err := k.verifyDst(ctx); err != nil {
		return err
	}
	k.helloReceived <- true
	return nil
}

func (k *Kex) PleaseSign(ctx *KexContext) error {
	G.Log.Info("[%s] PleaseSign Receive", k.debugName)
	defer G.Log.Info("[%s] PleaseSign Receive done", k.debugName)
	if err := k.verifyDst(ctx); err != nil {
		return err
	}

	ctx.Swap()

	return k.server.Done(ctx)
}

func (k *Kex) Done(ctx *KexContext) error {
	G.Log.Info("[%s] Done Receive", k.debugName)
	defer G.Log.Info("[%s] Done Receive done", k.debugName)
	if err := k.verifyDst(ctx); err != nil {
		return err
	}
	k.doneReceived <- true
	return nil
}

func (k *Kex) RegisterTestDevice(srv KexServer, device libkb.DeviceID) error { return nil }

func (k *Kex) verifyDst(ctx *KexContext) error {
	if ctx.Dst != k.deviceID {
		return fmt.Errorf("destination device id (%s) invalid.  this is device (%s).", ctx.Dst, k.deviceID)
	}
	return nil
}
