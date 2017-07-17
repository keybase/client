// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
	"golang.org/x/net/context"
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

func (e *SaltpackDecrypt) promptForDecrypt(ctx *Context, publicKey keybase1.KID, isAnon bool) (err error) {
	defer e.G().Trace("SaltpackDecrypt::promptForDecrypt", func() error { return err })()

	spsiArg := SaltpackSenderIdentifyArg{
		isAnon:           isAnon,
		publicKey:        publicKey,
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
	e.res.Sender = arg.Sender

	usedDelegateUI := false
	if e.G().UIRouter != nil {
		if ui, err := e.G().UIRouter.GetIdentifyUI(); err == nil && ui != nil {
			usedDelegateUI = true
		}
	}

	err = ctx.SaltpackUI.SaltpackPromptForDecrypt(context.TODO(), arg, usedDelegateUI)
	if err != nil {
		return err
	}
	return err
}

func (e *SaltpackDecrypt) makeMessageInfo(me *libkb.User, mki *saltpack.MessageKeyInfo) {
	if mki == nil || me == nil {
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

	// We don't load this in the --paperkey case.
	var me *libkb.User

	var key libkb.GenericKey
	if e.arg.Opts.UsePaperKey {
		// Prompt the user for a paper key. This doesn't require you to be
		// logged in.
		keypair, _, err := getPaperKey(e.G(), ctx, nil)
		if err != nil {
			return err
		}
		key = keypair.encKey
	} else {
		// Load self so that we can get device keys. This does require you to
		// be logged in.
		me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
		if err != nil {
			return err
		}
		// Get the device encryption key, maybe prompting the user.
		ska := libkb.SecretKeyArg{
			Me:      me,
			KeyType: libkb.DeviceEncryptionKeyType,
		}
		e.G().Log.Debug("| GetSecretKeyWithPrompt")
		key, err = e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "decrypting a message/file"))
		if err != nil {
			return err
		}
	}

	kp, ok := key.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return libkb.KeyCannotDecryptError{}
	}

	// For DH mode.
	hookMki := func(mki *saltpack.MessageKeyInfo) error {
		kidToIdentify := libkb.BoxPublicKeyToKeybaseKID(mki.SenderKey)
		return e.promptForDecrypt(ctx, kidToIdentify, mki.SenderIsAnon)
	}

	// For signcryption mode.
	hookSenderSigningKey := func(senderSigningKey saltpack.SigningPublicKey) error {
		kidToIdentify := libkb.SigningPublicKeyToKeybaseKID(senderSigningKey)
		// See if the sender signing key is nil or all zeroes.
		isAnon := false
		if senderSigningKey == nil || bytes.Equal(senderSigningKey.ToKID(), make([]byte, len(senderSigningKey.ToKID()))) {
			isAnon = true
		}
		return e.promptForDecrypt(ctx, kidToIdentify, isAnon)
	}

	e.G().Log.Debug("| SaltpackDecrypt")
	var mki *saltpack.MessageKeyInfo
	mki, err = libkb.SaltpackDecrypt(ctx.GetNetContext(), e.G(), e.arg.Source, e.arg.Sink, kp, hookMki, hookSenderSigningKey)
	if err == saltpack.ErrNoDecryptionKey {
		err = libkb.NoDecryptionKeyError{Msg: "no suitable device key found"}
	}

	// It's ok if me is nil here.
	e.makeMessageInfo(me, mki)

	return err
}

func (e *SaltpackDecrypt) MessageInfo() keybase1.SaltpackEncryptedMessageInfo {
	return e.res
}
