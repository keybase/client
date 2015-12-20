// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type SaltPackEncryptArg struct {
	Recips       []string // user assertions
	Source       io.Reader
	Sink         io.WriteCloser
	TrackOptions keybase1.TrackOptions
}

// SaltPackEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type SaltPackEncrypt struct {
	arg *SaltPackEncryptArg
	libkb.Contextified
}

// NewSaltPackEncrypt creates a SaltPackEncrypt engine.
func NewSaltPackEncrypt(arg *SaltPackEncryptArg, g *libkb.GlobalContext) *SaltPackEncrypt {
	return &SaltPackEncrypt{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *SaltPackEncrypt) Name() string {
	return "SaltPackEncrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *SaltPackEncrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltPackEncrypt) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceKeyfinder{},
	}
}

// Run starts the engine.
func (e *SaltPackEncrypt) Run(ctx *Context) (err error) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	// TODO: Add switch to not encrypt for oneself.
	meAssertion := fmt.Sprintf("uid:%s", me.GetUID())
	users := append([]string{meAssertion}, e.arg.Recips...)
	kfarg := DeviceKeyfinderArg{
		Me:           me,
		Users:        users,
		TrackOptions: e.arg.TrackOptions,
	}

	kf := NewDeviceKeyfinder(e.G(), kfarg)
	if err := RunEngine(kf, ctx); err != nil {
		return err
	}

	uplus := kf.UsersPlusDeviceKeys()
	var receivers []libkb.NaclDHKeyPublic
	for _, up := range uplus {
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
				receivers = append(receivers, kp.Public)
			}
		}
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

	return libkb.SaltPackEncrypt(e.arg.Source, e.arg.Sink, receivers, kp)
}
