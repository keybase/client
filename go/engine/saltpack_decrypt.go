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

type SaltPackDecryptArg struct {
	Source io.Reader
	Sink   io.WriteCloser
	Opts   keybase1.SaltPackDecryptOptions
}

// SaltPackDecrypt decrypts data read from a source into a sink.
type SaltPackDecrypt struct {
	libkb.Contextified
	arg *SaltPackDecryptArg
	res keybase1.SaltPackEncryptedMessageInfo
}

// NewSaltPackDecrypt creates a SaltPackDecrypt engine.
func NewSaltPackDecrypt(arg *SaltPackDecryptArg, g *libkb.GlobalContext) *SaltPackDecrypt {
	return &SaltPackDecrypt{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *SaltPackDecrypt) Name() string {
	return "SaltPackDecrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *SaltPackDecrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltPackDecrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SaltPackUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackDecrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&SaltPackSenderIdentify{},
	}
}

func (e *SaltPackDecrypt) promptForDecrypt(ctx *Context, mki *saltpack.MessageKeyInfo) (err error) {
	defer e.G().Trace("SaltPackDecrypt::promptForDecrypt", func() error { return err })()

	spsiArg := SaltPackSenderIdentifyArg{
		isAnon:           mki.SenderIsAnon,
		publicKey:        libkb.BoxPublicKeyToKeybaseKID(mki.SenderKey),
		interactive:      e.arg.Opts.Interactive,
		forceRemoteCheck: e.arg.Opts.ForceRemoteCheck,
		reason: keybase1.IdentifyReason{
			Reason: "Identify who encrypted this message",
			Type:   keybase1.IdentifyReasonType_DECRYPT,
		},
	}

	spsiEng := NewSaltPackSenderIdentify(e.G(), &spsiArg)
	if err = RunEngine(spsiEng, ctx); err != nil {
		return err
	}

	arg := keybase1.SaltPackPromptForDecryptArg{
		Sender: spsiEng.Result(),
	}

	err = ctx.SaltPackUI.SaltPackPromptForDecrypt(context.TODO(), arg)
	if err != nil {
		return err
	}
	return err
}

func (e *SaltPackDecrypt) makeMessageInfo(me *libkb.User, mki *saltpack.MessageKeyInfo) {
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
func (e *SaltPackDecrypt) Run(ctx *Context) (err error) {
	defer e.G().Trace("SaltPackDecrypt::Run", func() error { return err })()

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

	e.G().Log.Debug("| SaltPackDecrypt")
	var mki *saltpack.MessageKeyInfo
	mki, err = libkb.SaltPackDecrypt(e.G(), e.arg.Source, e.arg.Sink, kp, hook)
	if err == saltpack.ErrNoDecryptionKey {
		err = libkb.NoDecryptionKeyError{Msg: "no suitable device key found"}
	}

	e.makeMessageInfo(me, mki)

	return err
}

func (e *SaltPackDecrypt) MessageInfo() keybase1.SaltPackEncryptedMessageInfo {
	return e.res
}
