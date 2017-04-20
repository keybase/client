// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/hex"
	"fmt"
	"io"

	"github.com/keybase/client/go/chat/types"
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

	var symmetricReceivers []saltpack.ReceiverSymmetricKey
	if e.arg.Opts.Signcrypt && !e.arg.Opts.NoSelfEncrypt {
		symmetricReceivers, err = e.makeSymmetricReceivers(ctx)
		if err != nil {
			return err
		}
	}

	encarg := libkb.SaltpackEncryptArg{
		Source:             e.arg.Source,
		Sink:               e.arg.Sink,
		Receivers:          receivers,
		Sender:             senderDH,
		SenderSigning:      senderSigning,
		Binary:             e.arg.Opts.Binary,
		HideRecipients:     e.arg.Opts.HideRecipients,
		Signcrypt:          e.arg.Opts.Signcrypt,
		SymmetricReceivers: symmetricReceivers,
	}
	return libkb.SaltpackEncrypt(e.G(), &encarg)
}

// TODO: Make sure messages that encrypt only to self are working properly.
func (e *SaltpackEncrypt) makeSymmetricReceivers(ctx *Context) ([]saltpack.ReceiverSymmetricKey, error) {
	breaks := []keybase1.TLFIdentifyFailure{}
	identifyCtx := types.IdentifyModeCtx(ctx.GetNetContext(), keybase1.TLFIdentifyBehavior_CHAT_CLI, &breaks)

	// Fetch the TLF keys and assemble the pseudonym info objects.
	var cryptKeys []keybase1.CryptKey
	var pseudonymInfos []libkb.TlfPseudonymInfo
	for _, user := range e.arg.Opts.Recipients {
		tlfName := fmt.Sprintf("%s,%s", e.G().Env.GetUsername(), user)
		e.G().Log.Debug("saltpack signcryption fetching TLF key for %s", tlfName)
		res, err := e.G().TlfInfoSource.CompleteAndCanonicalizePrivateTlfName(identifyCtx, tlfName)
		if err != nil {
			return nil, err
		}
		if len(res.TlfID) != 32 {
			return nil, fmt.Errorf("TLF ID wrong length: %d", len(res.TlfID))
		}
		var tlfID [16]byte
		tlfIDSlice, err := hex.DecodeString(string(res.TlfID))
		if err != nil {
			return nil, err
		}
		copy(tlfID[:], tlfIDSlice)
		keys, err := e.G().TlfInfoSource.CryptKeys(identifyCtx, tlfName)
		if err != nil {
			return nil, err
		}
		maxKey := maxGenerationKey(keys.CryptKeys)
		pseudonymInfo := libkb.TlfPseudonymInfo{
			Name:    "/keybase/private/" + string(res.CanonicalName),
			ID:      tlfID,
			KeyGen:  libkb.KeyGen(maxKey.KeyGeneration),
			HmacKey: libkb.RandomHmacKey(),
		}
		cryptKeys = append(cryptKeys, maxKey)
		pseudonymInfos = append(pseudonymInfos, pseudonymInfo)
	}

	// Post the pseudonyms in a batch.
	pseudonyms, err := libkb.PostTlfPseudonyms(ctx.GetNetContext(), e.G(), pseudonymInfos)
	if err != nil {
		return nil, err
	}
	if len(pseudonyms) != len(pseudonymInfos) {
		return nil, fmt.Errorf("makeSymmetricReceivers got the wrong number of pseudonyms back (%d != %d)", len(pseudonyms), len(pseudonymInfos))
	}

	// Assemble the receivers.
	var receiverSymmetricKeys []saltpack.ReceiverSymmetricKey
	for i, key := range cryptKeys {
		receiverSymmetricKeys = append(receiverSymmetricKeys, saltpack.ReceiverSymmetricKey{
			Key:        saltpack.SymmetricKey(key.Key),
			Identifier: pseudonyms[i][:],
		})
	}
	return receiverSymmetricKeys, nil
}

func maxGenerationKey(keys []keybase1.CryptKey) keybase1.CryptKey {
	generation := -1
	var maxKey keybase1.CryptKey
	for _, key := range keys {
		if key.KeyGeneration > generation {
			generation = key.KeyGeneration
			maxKey = key
		}
	}
	return maxKey
}
