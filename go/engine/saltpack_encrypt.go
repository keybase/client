// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
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
	me  *libkb.User

	newKeyfinderHook (func(arg libkb.SaltpackRecipientKeyfinderArg) libkb.SaltpackRecipientKeyfinderEngineInterface)

	// Legacy encryption-only messages include a lot more information about
	// receivers, and it's nice to keep the helpful errors working while those
	// messages are still around.
	visibleRecipientsForTesting bool
}

// NewSaltpackEncrypt creates a SaltpackEncrypt engine.
func NewSaltpackEncrypt(arg *SaltpackEncryptArg, newKeyfinderHook func(arg libkb.SaltpackRecipientKeyfinderArg) libkb.SaltpackRecipientKeyfinderEngineInterface) *SaltpackEncrypt {
	return &SaltpackEncrypt{
		arg:              arg,
		newKeyfinderHook: newKeyfinderHook,
	}
}

// Name is the unique engine name.
func (e *SaltpackEncrypt) Name() string {
	return "SaltpackEncrypt"
}

// Prereqs returns the engine prereqs.
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
	// Note that potentially KeyfinderHook might return a different UIConsumer depending on its arguments,
	// which might make this call problematic, but all the hooks currently in use are not doing that.
	return []libkb.UIConsumer{
		e.newKeyfinderHook(libkb.SaltpackRecipientKeyfinderArg{}),
	}
}

func (e *SaltpackEncrypt) loadMe(m libkb.MetaContext) error {
	loggedIn, uid, err := isLoggedInWithUIDAndError(m)
	if err != nil && !e.arg.Opts.NoSelfEncrypt {
		return err
	}
	if !loggedIn {
		return nil
	}
	e.me, err = libkb.LoadMeByMetaContextAndUID(m, uid)
	return err
}

// Run starts the engine.
func (e *SaltpackEncrypt) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("SaltpackEncrypt::Run", func() error { return err })()

	if err = e.loadMe(m); err != nil {
		return err
	}

	if !(e.arg.Opts.UseEntityKeys || e.arg.Opts.UseDeviceKeys || e.arg.Opts.UsePaperKeys || e.arg.Opts.UseKBFSKeysOnlyForTesting) {
		return fmt.Errorf("no key type for encryption was specified")
	}

	kfarg := libkb.SaltpackRecipientKeyfinderArg{
		Recipients:        e.arg.Opts.Recipients,
		TeamRecipients:    e.arg.Opts.TeamRecipients,
		NoSelfEncrypt:     e.arg.Opts.NoSelfEncrypt,
		UseEntityKeys:     e.arg.Opts.UseEntityKeys,
		UsePaperKeys:      e.arg.Opts.UsePaperKeys,
		UseDeviceKeys:     e.arg.Opts.UseDeviceKeys,
		UseRepudiableAuth: e.arg.Opts.AuthenticityType == keybase1.AuthenticityType_REPUDIABLE,
	}

	kf := e.newKeyfinderHook(kfarg)
	if err := RunEngine2(m, kf); err != nil {
		return err
	}

	var receivers []libkb.NaclDHKeyPublic
	for _, KID := range kf.GetPublicKIDs() {
		gk, err := libkb.ImportKeypairFromKID(KID)
		if err != nil {
			return err
		}
		kp, ok := gk.(libkb.NaclDHKeyPair)
		if !ok {
			return libkb.KeyCannotEncryptError{}
		}
		receivers = append(receivers, kp.Public)
	}

	var symmetricReceivers []saltpack.ReceiverSymmetricKey
	for _, key := range kf.GetSymmetricKeys() {
		symmetricReceivers = append(symmetricReceivers, saltpack.ReceiverSymmetricKey{
			Key:        saltpack.SymmetricKey(key.Key),
			Identifier: key.Identifier,
		})
	}

	// This flag determines whether saltpack is used in signcryption (false)
	// vs encryption (true) format.
	encryptionOnlyMode := false

	var senderDH libkb.NaclDHKeyPair
	if e.arg.Opts.AuthenticityType == keybase1.AuthenticityType_REPUDIABLE && e.me != nil {
		encryptionOnlyMode = true

		secretKeyArgDH := libkb.SecretKeyArg{
			Me:      e.me,
			KeyType: libkb.DeviceEncryptionKeyType,
		}
		dhKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(secretKeyArgDH, "encrypting a message/file"))
		if err != nil {
			return err
		}
		dhKeypair, ok := dhKey.(libkb.NaclDHKeyPair)
		if !ok || dhKeypair.Private == nil {
			return libkb.KeyCannotEncryptError{}
		}
		senderDH = dhKeypair
	}

	var senderSigning libkb.NaclSigningKeyPair
	if e.arg.Opts.AuthenticityType == keybase1.AuthenticityType_SIGNED && e.me != nil {
		secretKeyArgSigning := libkb.SecretKeyArg{
			Me:      e.me,
			KeyType: libkb.DeviceSigningKeyType,
		}
		signingKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(secretKeyArgSigning, "signing a message/file"))
		if err != nil {
			return err
		}
		signingKeypair, ok := signingKey.(libkb.NaclSigningKeyPair)
		if !ok || signingKeypair.Private == nil {
			//Perhaps a KeyCannotEncrypt error, although less accurate, would be more intuitive for the user.
			return libkb.KeyCannotSignError{}
		}
		senderSigning = signingKeypair
	}

	if e.arg.Opts.AuthenticityType != keybase1.AuthenticityType_ANONYMOUS && e.me == nil {
		return libkb.NewLoginRequiredError("authenticating a message requires login. Either login or use --auth-type=anonymous")
	}

	saltpackVersion, err := libkb.SaltpackVersionFromArg(e.arg.Opts.SaltpackVersion)
	if err != nil {
		return err
	}

	encarg := libkb.SaltpackEncryptArg{
		Source:             e.arg.Source,
		Sink:               e.arg.Sink,
		Receivers:          receivers,
		Sender:             senderDH,
		SenderSigning:      senderSigning,
		Binary:             e.arg.Opts.Binary,
		EncryptionOnlyMode: encryptionOnlyMode,
		SymmetricReceivers: symmetricReceivers,
		SaltpackVersion:    saltpackVersion,

		VisibleRecipientsForTesting: e.visibleRecipientsForTesting,
	}
	return libkb.SaltpackEncrypt(m, &encarg)
}
