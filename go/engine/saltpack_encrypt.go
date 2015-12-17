// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	"io"
)

type SaltPackEncryptArg struct {
	Recips        []string // user assertions
	Source        io.Reader
	Sink          io.WriteCloser
	NoSelfEncrypt bool
	HideSender    bool
}

// SaltPackEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type SaltPackEncrypt struct {
	arg *SaltPackEncryptArg
	libkb.Contextified
	me *libkb.User
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

func (e *SaltPackEncrypt) loadMyPublicKeys() ([]libkb.NaclDHKeyPublic, error) {

	var ret []libkb.NaclDHKeyPublic

	ckf := e.me.GetComputedKeyFamily()
	if ckf == nil {
		return ret, libkb.NoKeyError{Msg: "no suitable encryption keys found for you"}
	}
	keys := ckf.GetAllActiveSubkeys()
	for _, key := range keys {
		if kp, ok := key.(libkb.NaclDHKeyPair); ok {
			ret = append(ret, kp.Public)
		}
	}

	if len(ret) == 0 {
		return ret, libkb.NoKeyError{Msg: "no suitable encryption keys found for you"}
	}
	return ret, nil
}

func (e *SaltPackEncrypt) loadMe(ctx *Context) error {
	loggedIn, err := IsLoggedIn(e, ctx)
	if err != nil || !loggedIn {
		return err
	}
	e.me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	return err
}

// Run starts the engine.
func (e *SaltPackEncrypt) Run(ctx *Context) (err error) {

	libkb.Trace(e.G().Log, "SaltPackEncrypt::Run", func() error { return err })

	var receivers []libkb.NaclDHKeyPublic
	var sender libkb.NaclDHKeyPair

	if err = e.loadMe(ctx); err != nil {
		return err
	}

	if !e.arg.NoSelfEncrypt && e.me != nil {
		receivers, err = e.loadMyPublicKeys()
		if err != nil {
			return err
		}
	}

	kfarg := DeviceKeyfinderArg{
		Users:           e.arg.Recips,
		NeedEncryptKeys: true,
		Self:            e.me,
	}

	kf := NewDeviceKeyfinder(e.G(), kfarg)
	if err := RunEngine(kf, ctx); err != nil {
		return err
	}
	uplus := kf.UsersPlusDeviceKeys()
	for _, up := range uplus {
		for _, k := range up.Upk.Keys {
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

	if !e.arg.HideSender && e.me != nil {
		ska := libkb.SecretKeyArg{
			Me:      e.me,
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
		sender = kp
	}

	return libkb.SaltPackEncrypt(e.arg.Source, e.arg.Sink, receivers, sender)
}
