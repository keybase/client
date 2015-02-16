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

type KexServer interface {
	StartKexSession(id KexStrongID, context *KexContext) error
	StartReverseKexSession(context *KexContext) error
	Hello(context *KexContext) error
	PleaseSign(context *KexContext) error
	Done(context *KexContext) error

	// XXX get rid of this when real client comm works
	RegisterTestDevice(srv KexServer, device libkb.DeviceID) error
}

type Kex struct {
	server        KexServer
	user          *libkb.User
	sessionID     KexStrongID
	helloReceived chan bool
}

var kexTimeout = 5 * time.Minute

func NewKex(s KexServer) *Kex {
	return &Kex{server: s, helloReceived: make(chan bool, 1)}
}

func (k *Kex) Run(u *libkb.User, src, dst libkb.DeviceID) error {
	k.user = u

	// XXX this is just for testing
	k.server.RegisterTestDevice(k, src)

	// make random secret S
	words, id, err := k.secret()
	if err != nil {
		return err
	}
	G.Log.Info("kex: words = %v, id = %x", words, id)

	k.sessionID = id

	context := &KexContext{
		UserID:   k.user.GetUid(),
		StrongID: id,
		Src:      src,
		Dst:      dst,
	}

	if err := k.server.StartKexSession(id, context); err != nil {
		return err
	}
	//	go k.server.StartKexSession(id, context)

	// tell user the command to enter on existing device (X)

	// wait for Hello() from X
	if err := k.waitHello(); err != nil {
		return err
	}

	// send PleaseSign(...) to X

	G.Log.Info("kex with existing device not yet implemented")
	return ErrNotYetImplemented
}

func (k *Kex) waitHello() error {
	G.Log.Info("waitHello start")
	defer G.Log.Info("waitHello done")
	select {
	case <-k.helloReceived:
		G.Log.Info("hello received")
		return nil
	case <-time.After(kexTimeout):
		return fmt.Errorf("timeout waiting for Hello")
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

func (k *Kex) StartKexSession(id KexStrongID, context *KexContext) error {
	G.Log.Info("StartKexSession: %x, %v", id, context)
	defer G.Log.Info("StartKexSession done")
	return k.server.Hello(context)
}

func (k *Kex) StartReverseKexSession(context *KexContext) error { return nil }

func (k *Kex) Hello(context *KexContext) error {
	G.Log.Info("Hello")
	defer G.Log.Info("Hello done")
	k.helloReceived <- true
	return nil
}

func (k *Kex) PleaseSign(context *KexContext) error                          { return nil }
func (k *Kex) Done(context *KexContext) error                                { return nil }
func (k *Kex) RegisterTestDevice(srv KexServer, device libkb.DeviceID) error { return nil }
