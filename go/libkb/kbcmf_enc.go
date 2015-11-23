// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"io"

	"golang.org/x/crypto/nacl/box"

	"github.com/keybase/client/go/kbcmf"
)

type naclBoxPublicKey NaclDHKeyPublic

func (b naclBoxPublicKey) ToRawBoxKeyPointer() *kbcmf.RawBoxKey {
	return (*kbcmf.RawBoxKey)(&b)
}

func (b naclBoxPublicKey) ToKID() []byte {
	return b[:]
}

type naclBoxSecretKey NaclDHKeyPair

func (n naclBoxSecretKey) GetPublicKey() kbcmf.BoxPublicKey {
	return naclBoxPublicKey(n.Public)
}

func (b naclBoxSecretKey) Box(receiver kbcmf.BoxPublicKey, nonce *kbcmf.Nonce, msg []byte) ([]byte, error) {
	ret := box.Seal([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(receiver.ToRawBoxKeyPointer()), (*[32]byte)(b.Private))
	return ret, nil
}

var errPublicKeyDecryptionFailed = errors.New("public key decryption failed")

func (b naclBoxSecretKey) Unbox(sender kbcmf.BoxPublicKey, nonce *kbcmf.Nonce, msg []byte) ([]byte, error) {
	out, ok := box.Open([]byte{}, msg, (*[24]byte)(nonce),
		(*[32]byte)(sender.ToRawBoxKeyPointer()), (*[32]byte)(b.Private))
	if !ok {
		return nil, errPublicKeyDecryptionFailed
	}
	return out, nil
}

func KBCMFEncrypt(source io.Reader, sink io.WriteCloser, recipients [][]NaclDHKeyPublic, sender NaclDHKeyPair) error {
	var r [][]kbcmf.BoxPublicKey
	for _, recipient := range recipients {
		var ur []kbcmf.BoxPublicKey
		for _, k := range recipient {
			ur = append(ur, naclBoxPublicKey(k))
		}
		r = append(r, ur)
	}
	plainsink, err := kbcmf.NewEncryptArmor62Stream(sink, naclBoxSecretKey(sender), r)
	if err != nil {
		return err
	}

	n, err := io.Copy(plainsink, source)
	if err != nil {
		return err
	}
	G.Log.Debug("Encrypt: wrote %d bytes", n)
	if err := plainsink.Close(); err != nil {
		return err
	}
	if err := sink.Close(); err != nil {
		return err
	}
	return nil
}
