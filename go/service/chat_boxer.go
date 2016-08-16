// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor/protocol/chat1"
)

type chatBoxer struct {
	tlf keybase1.TlfInterface
}

// unboxMessage unboxes a chat1.MessageBoxed into a keybase1.Message.  It finds
// the appropriate keybase1.CryptKey.
func (b *chatBoxer) unboxMessage(ctx context.Context, finder *keyFinder, msg chat1.MessageBoxed) (keybase1.Message, error) {
	tlfName := msg.ClientHeader.TlfName
	keys, err := finder.find(ctx, b.tlf, tlfName)
	if err != nil {
		return keybase1.Message{}, err
	}

	var matchKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if key.KeyGeneration == msg.KeyGeneration {
			matchKey = &key
			break
		}
	}

	if matchKey == nil {
		return keybase1.Message{}, fmt.Errorf("no key found for generation %d", msg.KeyGeneration)
	}

	return b.unboxMessageWithKey(msg, matchKey)
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

	return unboxed, nil

}

// boxMessage encrypts a keybase1.MessagePlaintext into a chat1.MessageBoxed.  It
// finds the most recent key for the TLF.
func (b *chatBoxer) boxMessage(ctx context.Context, msg keybase1.MessagePlaintext) (chat1.MessageBoxed, error) {
	tlfName := msg.ClientHeader.TlfName
	keys, err := b.tlf.CryptKeys(ctx, tlfName)
	if err != nil {
		return chat1.MessageBoxed{}, err
	}

	var recentKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if recentKey == nil || key.KeyGeneration > recentKey.KeyGeneration {
			recentKey = &key
		}
	}

	if recentKey == nil {
		return chat1.MessageBoxed{}, fmt.Errorf("no key found for tlf %q", tlfName)
	}

	return b.boxMessageWithKey(msg, recentKey)
}

// boxMessageWithKey encrypts a keybase1.MessagePlaintext into a chat1.MessageBoxed
// given a keybase1.CryptKey.
func (b *chatBoxer) boxMessageWithKey(msg keybase1.MessagePlaintext, key *keybase1.CryptKey) (chat1.MessageBoxed, error) {
	s, err := json.Marshal(msg)
	if err != nil {
		return chat1.MessageBoxed{}, err
	}

	var nonce [libkb.NaclDHNonceSize]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return chat1.MessageBoxed{}, err
	}

	sealed := secretbox.Seal(nil, []byte(s), &nonce, ((*[32]byte)(&key.Key)))

	boxed := chat1.MessageBoxed{
		ClientHeader: msg.ClientHeader,
		BodyCiphertext: chat1.EncryptedData{
			V: 1,
			E: sealed,
			N: nonce[:],
		},
		KeyGeneration: key.KeyGeneration,
	}

	return boxed, nil
}

// verifyMessageBoxed verifies the header and body signatures in a boxed
// message.
func (b *chatBoxer) verifyMessageBoxed(msg chat1.MessageBoxed) error {
	header, err := json.Marshal(msg.ClientHeader)
	if err != nil {
		return err
	}
	if !b.verify(header, msg.HeaderSignature) {
		return libkb.BadSigError{E: "header signature invalid"}
	}

	if !b.verify(msg.BodyCiphertext.E, msg.BodySignature) {
		return libkb.BadSigError{E: "body signature invalid"}
	}

	return nil
}

// verify verifies the signature of data using SignatureInfo.
func (b *chatBoxer) verify(data []byte, si chat1.SignatureInfo) bool {
	var pub libkb.NaclSigningKeyPublic
	copy(pub[:], si.K)

	var sig libkb.NaclSignature
	copy(sig[:], si.S)

	return pub.Verify(data, &sig)
}
