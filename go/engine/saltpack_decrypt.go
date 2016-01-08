// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/saltpack"
	"golang.org/x/net/context"
	"io"
)

type SaltpackDecryptArg struct {
	Source io.Reader
	Sink   io.WriteCloser
	Opts   keybase1.SaltpackDecryptOptions
}

// SaltpackDecrypt decrypts data read from a source into a sink.
type SaltpackDecrypt struct {
	libkb.Contextified
	arg *SaltpackDecryptArg
	res keybase1.SaltpackEncryptedMessageInfo
}

// NewSaltpackDecrypt creates a SaltpackDecrypt engine.
func NewSaltpackDecrypt(arg *SaltpackDecryptArg, g *libkb.GlobalContext) *SaltpackDecrypt {
	return &SaltpackDecrypt{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *SaltpackDecrypt) Name() string {
	return "SaltpackDecrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *SaltpackDecrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltpackDecrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SaltpackUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltpackDecrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&SaltpackSenderIdentify{},
	}
}

func (e *SaltpackDecrypt) promptForDecrypt(ctx *Context, mki *saltpack.MessageKeyInfo) (err error) {
	defer e.G().Trace("SaltpackDecrypt::promptForDecrypt", func() error { return err })()

	spsiArg := SaltpackSenderIdentifyArg{
		isAnon:           mki.SenderIsAnon,
		publicKey:        libkb.BoxPublicKeyToKeybaseKID(mki.SenderKey),
		interactive:      e.arg.Opts.Interactive,
		forceRemoteCheck: e.arg.Opts.ForceRemoteCheck,
		reason: keybase1.IdentifyReason{
			Reason: "Identify who encrypted this message",
			Type:   keybase1.IdentifyReasonType_DECRYPT,
		},
	}

	spsiEng := NewSaltpackSenderIdentify(e.G(), &spsiArg)
	if err = RunEngine(spsiEng, ctx); err != nil {
		return err
	}

	arg := keybase1.SaltpackPromptForDecryptArg{
		Sender: spsiEng.Result(),
	}

	err = ctx.SaltpackUI.SaltpackPromptForDecrypt(context.TODO(), arg)
	if err != nil {
		return err
	}
	return err
}

func (e *SaltpackDecrypt) makeMessageInfo(me *libkb.User, mki *saltpack.MessageKeyInfo) {
	if mki == nil {
		return
	}
	ckf := me.GetComputedKeyFamily()
	for _, nr := range mki.NamedReceivers {
		kid := keybase1.KIDFromRawKey(nr, libkb.KIDNaclDH)
		if dev, _ := ckf.GetDeviceForKID(kid); dev != nil {
			edev := dev.ProtExport()
			edev.EncryptKey = kid
			e.res.Devices = append(e.res.Devices, *edev)
		}
	}
	e.res.NumAnonReceivers = mki.NumAnonReceivers
	e.res.ReceiverIsAnon = mki.ReceiverIsAnon
}

// Run starts the engine.
func (e *SaltpackDecrypt) Run(ctx *Context) (err error) {
	defer e.G().Trace("SaltpackDecrypt::Run", func() error { return err })()

	var me *libkb.User
	me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))

	if err != nil {
		return err
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	e.G().Log.Debug("| GetSecretKeyWithPrompt")
	key, err := e.G().Keyrings.GetSecretKeyWithPrompt(
		ctx.LoginContext, ska, ctx.SecretUI,
		"decrypting a message/file")
	if err != nil {
		return err
	}

	kp, ok := key.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return libkb.KeyCannotDecryptError{}
	}

	hook := func(mki *saltpack.MessageKeyInfo) error {
		return e.promptForDecrypt(ctx, mki)
	}

	e.G().Log.Debug("| SaltpackDecrypt")
	var mki *saltpack.MessageKeyInfo
	mki, err = libkb.SaltpackDecrypt(e.G(), e.arg.Source, e.arg.Sink, kp, hook)
	if err == saltpack.ErrNoDecryptionKey {
		err = libkb.NoDecryptionKeyError{Msg: "no suitable device key found"}
	}

	e.makeMessageInfo(me, mki)

	return err
}

func (e *SaltpackDecrypt) MessageInfo() keybase1.SaltpackEncryptedMessageInfo {
	return e.res
}
