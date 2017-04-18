// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type SaltpackEncryptArg struct {
	Opts   keybase1.SaltpackEncryptOptions
	Source io.Reader
	Sink   io.WriteCloser
}

// SaltpackEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type SaltpackEncrypt struct {
	arg *SaltpackEncryptArg
	libkb.Contextified
	me *libkb.User
}

// NewSaltpackEncrypt creates a SaltpackEncrypt engine.
func NewSaltpackEncrypt(arg *SaltpackEncryptArg, g *libkb.GlobalContext) *SaltpackEncrypt {
	return &SaltpackEncrypt{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *SaltpackEncrypt) Name() string {
	return "SaltpackEncrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *SaltpackEncrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltpackEncrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltpackEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceKeyfinder{},
	}
}

func (e *SaltpackEncrypt) loadMyPublicKeys() ([]libkb.NaclDHKeyPublic, error) {

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

func (e *SaltpackEncrypt) loadMe(ctx *Context) error {
	loggedIn, uid, err := IsLoggedIn(e, ctx)
	if err != nil || !loggedIn {
		return err
	}
	e.me, err = libkb.LoadMeByUID(ctx.GetNetContext(), e.G(), uid)
	return err
}

// Run starts the engine.
func (e *SaltpackEncrypt) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ SaltpackEncrypt::Run")
	defer func() {
		e.G().Log.Debug("- SaltpackEncrypt::Run -> %v", err)
	}()

	var receivers []libkb.NaclDHKeyPublic

	if err = e.loadMe(ctx); err != nil {
		return err
	}

	if !e.arg.Opts.NoSelfEncrypt && e.me != nil {
		receivers, err = e.loadMyPublicKeys()
		if err != nil {
			return err
		}
	}

	kfarg := DeviceKeyfinderArg{
		Users:           e.arg.Opts.Recipients,
		NeedEncryptKeys: true,
		Self:            e.me,
	}

	kf := NewDeviceKeyfinder(e.G(), kfarg)
	if err := RunEngine(kf, ctx); err != nil {
		return err
	}
	uplus := kf.UsersPlusKeys()
	for _, up := range uplus {
		for _, k := range up.DeviceKeys {
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

	var senderDH libkb.NaclDHKeyPair
	if !e.arg.Opts.HideSelf && e.me != nil {
		secretKeyArgDH := libkb.SecretKeyArg{
			Me:      e.me,
			KeyType: libkb.DeviceEncryptionKeyType,
		}
		dhKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(secretKeyArgDH, "encrypting a message/file"))
		if err != nil {
			return err
		}
		dhKeypair, ok := dhKey.(libkb.NaclDHKeyPair)
		if !ok || dhKeypair.Private == nil {
			return libkb.KeyCannotDecryptError{}
		}
		senderDH = dhKeypair
	}

	var senderSigning libkb.NaclSigningKeyPair
	if e.arg.Opts.Signcrypt && e.me != nil {
		secretKeyArgSigning := libkb.SecretKeyArg{
			Me:      e.me,
			KeyType: libkb.DeviceSigningKeyType,
		}
		signingKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(secretKeyArgSigning, "signing a message/file"))
		if err != nil {
			return err
		}
		signingKeypair, ok := signingKey.(libkb.NaclSigningKeyPair)
		if !ok || signingKeypair.Private == nil {
			return libkb.KeyCannotDecryptError{}
		}
		senderSigning = signingKeypair
	}

	encarg := libkb.SaltpackEncryptArg{
		Source:         e.arg.Source,
		Sink:           e.arg.Sink,
		Receivers:      receivers,
		Sender:         senderDH,
		SenderSigning:  senderSigning,
		Binary:         e.arg.Opts.Binary,
		HideRecipients: e.arg.Opts.HideRecipients,
		Signcrypt:      e.arg.Opts.Signcrypt,
	}
	return libkb.SaltpackEncrypt(e.G(), &encarg)
}
