// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type chatBoxer struct {
	tlf keybase1.TlfInterface
	libkb.Contextified
}

func newChatBoxer(g *libkb.GlobalContext) *chatBoxer {
	return &chatBoxer{
		tlf:          newTlfHandler(nil, g),
		Contextified: libkb.NewContextified(g),
	}
}

// unboxMessage unboxes a chat1.MessageBoxed into a keybase1.Message.  It finds
// the appropriate keybase1.CryptKey.
func (b *chatBoxer) unboxMessage(ctx context.Context, finder *keyFinder, boxed chat1.MessageBoxed) (unboxed keybase1.Message, err error) {
	tlfName := boxed.ClientHeader.TlfName
	keys, err := finder.find(ctx, b.tlf, tlfName)
	if err != nil {
		return unboxed, libkb.ChatUnboxingError{Msg: err.Error()}
	}

	var matchKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if key.KeyGeneration == boxed.KeyGeneration {
			matchKey = &key
			break
		}
	}

	if matchKey == nil {
		return unboxed, libkb.ChatUnboxingError{Msg: fmt.Sprintf("no key found for generation %d", boxed.KeyGeneration)}
	}

	if unboxed, err = b.unboxMessageWithKey(boxed, matchKey); err != nil {
		return unboxed, libkb.ChatUnboxingError{Msg: err.Error()}
	}

	return unboxed, nil
}

// unboxMessageWithKey unboxes a chat1.MessageBoxed into a keybase1.Message given
// a keybase1.CryptKey.
func (b *chatBoxer) unboxMessageWithKey(msg chat1.MessageBoxed, key *keybase1.CryptKey) (keybase1.Message, error) {
	if msg.ServerHeader == nil {
		return keybase1.Message{}, errors.New("nil ServerHeader in MessageBoxed")
	}

	if err := b.verifyMessageBoxed(msg); err != nil {
		return keybase1.Message{}, err
	}

	unboxed := keybase1.Message{
		ServerHeader: *msg.ServerHeader,
	}

	if len(msg.BodyCiphertext.N) != libkb.NaclDHNonceSize {
		return keybase1.Message{}, libkb.DecryptBadNonceError{}
	}
	var nonce [libkb.NaclDHNonceSize]byte
	copy(nonce[:], msg.BodyCiphertext.N)

	plaintext, ok := secretbox.Open(nil, msg.BodyCiphertext.E, &nonce, ((*[32]byte)(&key.Key)))
	if !ok {
		return keybase1.Message{}, libkb.DecryptOpenError{}
	}

	if err := json.Unmarshal(plaintext, &unboxed.MessagePlaintext); err != nil {
		return keybase1.Message{}, err
	}

	if !reflect.DeepEqual(unboxed.MessagePlaintext.ClientHeader, msg.ClientHeader) {
		return keybase1.Message{}, errors.New("unboxed ClientHeader does not match ClientHeader in MessageBoxed")
	}

	return unboxed, nil

}

// boxMessage encrypts a keybase1.MessagePlaintext into a chat1.MessageBoxed.  It
// finds the most recent key for the TLF.
func (b *chatBoxer) boxMessage(ctx context.Context, msg keybase1.MessagePlaintext, signingKeyPair libkb.NaclSigningKeyPair) (boxed chat1.MessageBoxed, err error) {
	tlfName := msg.ClientHeader.TlfName
	keys, err := b.tlf.CryptKeys(ctx, tlfName)
	if err != nil {
		return boxed, libkb.ChatBoxingError{Msg: err.Error()}
	}

	var recentKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if recentKey == nil || key.KeyGeneration > recentKey.KeyGeneration {
			recentKey = &key
		}
	}

	if recentKey == nil {
		return boxed, libkb.ChatBoxingError{Msg: fmt.Sprintf("no key found for tlf %q", tlfName)}
	}

	if boxed, err = b.boxMessageWithKeys(msg, recentKey, signingKeyPair); err != nil {
		return boxed, libkb.ChatBoxingError{Msg: err.Error()}
	}
	return boxed, nil
}

// boxMessageWithKey encrypts and signs a keybase1.MessagePlaintext into a
// chat1.MessageBoxed given a keybase1.CryptKey.
func (b *chatBoxer) boxMessageWithKeys(msg keybase1.MessagePlaintext, key *keybase1.CryptKey, signingKeyPair libkb.NaclSigningKeyPair) (boxed chat1.MessageBoxed, err error) {
	s, err := json.Marshal(msg)
	if err != nil {
		return boxed, err
	}

	var nonce [libkb.NaclDHNonceSize]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return boxed, err
	}

	sealed := secretbox.Seal(nil, []byte(s), &nonce, ((*[32]byte)(&key.Key)))

	boxed = chat1.MessageBoxed{
		ClientHeader: msg.ClientHeader,
		BodyCiphertext: chat1.EncryptedData{
			V: 1,
			E: sealed,
			N: nonce[:],
		},
		KeyGeneration: key.KeyGeneration,
	}

	// sign the header, encrypted body
	if err := b.signMessageBoxed(&boxed, signingKeyPair); err != nil {
		return boxed, err
	}

	return boxed, nil
}

// signMessageBoxed signs the header and encrypted body of a chat1.MessageBoxed
// with the NaclSigningKeyPair.
func (b *chatBoxer) signMessageBoxed(msg *chat1.MessageBoxed, kp libkb.NaclSigningKeyPair) error {
	header, err := b.signJSON(msg.ClientHeader, kp, libkb.SignaturePrefixChatHeader)
	if err != nil {
		return err
	}
	msg.HeaderSignature = header

	body, err := b.sign(msg.BodyCiphertext.E, kp, libkb.SignaturePrefixChatBody)
	if err != nil {
		return err
	}
	msg.BodySignature = body

	return nil
}

// signJSON signs data with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
// It encodes data to JSON before signing.
func (b *chatBoxer) signJSON(data interface{}, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
	encoded, err := json.Marshal(data)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}

	return b.sign(encoded, kp, prefix)
}

func exportSigInfo(si *libkb.NaclSigInfo) chat1.SignatureInfo {
	return chat1.SignatureInfo{
		V: si.Version,
		S: si.Sig[:],
		K: si.Kid,
	}
}

// sign signs msg with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
func (b *chatBoxer) sign(msg []byte, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
	sig, err := kp.SignV2(msg, prefix)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}
	return exportSigInfo(sig), nil
}

// verifyMessageBoxed verifies the header and body signatures in a boxed
// message.
func (b *chatBoxer) verifyMessageBoxed(msg chat1.MessageBoxed) error {
	header, err := json.Marshal(msg.ClientHeader)
	if err != nil {
		return err
	}
	if !b.verify(header, msg.HeaderSignature, libkb.SignaturePrefixChatHeader) {
		return libkb.BadSigError{E: "header signature invalid"}
	}

	if !b.verify(msg.BodyCiphertext.E, msg.BodySignature, libkb.SignaturePrefixChatBody) {
		return libkb.BadSigError{E: "body signature invalid"}
	}

	if !libkb.SecureByteArrayEq(msg.HeaderSignature.K, msg.BodySignature.K) {
		return errors.New("header and body signature keys do not match")
	}

	valid, err := b.validSenderKey(msg.ClientHeader.Sender, msg.HeaderSignature.K, msg.ServerHeader.Ctime)
	if err != nil {
		return err
	}
	if !valid {
		return errors.New("key invalid for sender at message ctime")
	}

	return nil
}

// verify verifies the signature of data using SignatureInfo.
func (b *chatBoxer) verify(data []byte, si chat1.SignatureInfo, prefix libkb.SignaturePrefix) bool {
	sigInfo := libkb.NaclSigInfo{
		Version: si.V,
		Prefix:  prefix,
		Kid:     si.K,
		Payload: data,
	}
	copy(sigInfo.Sig[:], si.S)
	_, err := sigInfo.Verify()
	return (err == nil)
}

// validSenderKey checks that the key is active for sender at ctime.
func (b *chatBoxer) validSenderKey(sender gregor1.UID, key []byte, ctime gregor1.Time) (bool, error) {
	kbSender, err := keybase1.UIDFromString(hex.EncodeToString(sender.Bytes()))
	if err != nil {
		return false, err
	}
	kid := keybase1.KIDFromSlice(key)
	t := gregor1.FromTime(ctime)

	user, err := libkb.LoadUser(libkb.NewLoadUserByUIDArg(b.G(), kbSender))
	if err != nil {
		return false, err
	}
	ckf := user.GetComputedKeyFamily()
	if ckf == nil {
		return false, errors.New("no computed key family")
	}
	activeKey, _, err := ckf.FindActiveSibkeyAtTime(kid, t)
	if err != nil {
		return false, err
	}
	if activeKey == nil {
		return false, nil
	}

	return true, nil
}
