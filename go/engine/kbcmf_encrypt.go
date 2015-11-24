// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type KBCMFEncryptArg struct {
	Recips       []string // user assertions
	Source       io.Reader
	Sink         io.WriteCloser
	TrackOptions keybase1.TrackOptions
}

// KBCMFEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type KBCMFEncrypt struct {
	arg *KBCMFEncryptArg
	libkb.Contextified
}

// NewKBCMFEncrypt creates a KBCMFEncrypt engine.
func NewKBCMFEncrypt(arg *KBCMFEncryptArg, g *libkb.GlobalContext) *KBCMFEncrypt {
	return &KBCMFEncrypt{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *KBCMFEncrypt) Name() string {
	return "KBCMFEncrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *KBCMFEncrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *KBCMFEncrypt) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine.
func (e *KBCMFEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceKeyfinder{},
	}
}

// Run starts the engine.
func (e *KBCMFEncrypt) Run(ctx *Context) (err error) {
	kfarg := &DeviceKeyfinderArg{
		Users:        e.arg.Recips,
		TrackOptions: e.arg.TrackOptions,
	}

	kf := NewDeviceKeyfinder(kfarg, e.G())
	if err := RunEngine(kf, ctx); err != nil {
		return err
	}

	var receivers [][]libkb.NaclDHKeyPublic
	uplus := kf.UsersPlusDeviceKeys()
	for _, up := range uplus {
		var receiver []libkb.NaclDHKeyPublic
		for _, k := range up.Keys {
			if !k.IsSibkey {
				gk, err := libkb.ImportKeypairFromKID(k.KID)
				if err != nil {
					return err
				}
				kp, ok := gk.(libkb.NaclDHKeyPair)
				if !ok {
					return libkb.KeyCannotEncryptError{}
				}

				receiver = append(receiver, kp.Public)
			}
		}
		receivers = append(receivers, receiver)
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	key, err := e.G().Keyrings.GetSecretKeyWithPrompt(
		ctx.LoginContext, ska, ctx.SecretUI,
		"encrypting a message/file")
	if err != nil {
		return err
	}
	kp, ok := key.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return libkb.KeyCannotDecryptError{}
	}

	return libkb.KBCMFEncrypt(e.arg.Source, e.arg.Sink, receivers, kp)
}
