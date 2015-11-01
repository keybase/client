// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/crypto/nacl/box"
)

func getMySecretKey(
	g *libkb.GlobalContext, secretUI libkb.SecretUI,
	secretKeyType libkb.SecretKeyType, reason string) (
	libkb.GenericKey, error) {

	var key libkb.GenericKey
	var err error
	aerr := g.LoginState().Account(func(a *libkb.Account) {
		key, err = a.CachedSecretKey(libkb.SecretKeyArg{KeyType: secretKeyType})
	}, "Keyrings - cachedSecretKey")
	if key != nil && err == nil {
		return key, nil
	}
	if aerr != nil {
		g.Log.Debug("error getting account: %s", aerr)
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return nil, err
	}

	return g.Keyrings.GetSecretKeyWithPrompt(nil,
		libkb.SecretKeyArg{
			Me:      me,
			KeyType: secretKeyType,
		}, secretUI, reason)
}

// SignED25519 signs the given message with the current user's private
// signing key.
func SignED25519(g *libkb.GlobalContext, secretUI libkb.SecretUI,
	arg keybase1.SignED25519Arg) (
	ret keybase1.ED25519SignatureInfo, err error) {
	signingKey, err := getMySecretKey(
		g, secretUI, libkb.DeviceSigningKeyType, arg.Reason)
	if err != nil {
		return
	}

	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		err = libkb.KeyCannotSignError{}
		return
	}

	sig := *kp.Private.Sign(arg.Msg)
	publicKey := kp.Public
	ret = keybase1.ED25519SignatureInfo{
		Sig:       keybase1.ED25519Signature(sig),
		PublicKey: keybase1.ED25519PublicKey(publicKey),
	}
	return
}

// UnboxBytes32 decrypts the given message with the current user's
// private encryption key and the given nonce and peer public key.
func UnboxBytes32(g *libkb.GlobalContext, secretUI libkb.SecretUI,
	arg keybase1.UnboxBytes32Arg) (bytes32 keybase1.Bytes32, err error) {
	encryptionKey, err := getMySecretKey(
		g, secretUI, libkb.DeviceEncryptionKeyType, arg.Reason)
	if err != nil {
		return
	}

	kp, ok := encryptionKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		err = libkb.KeyCannotDecryptError{}
		return
	}

	decryptedData, ok := box.Open(nil, arg.EncryptedBytes32[:],
		(*[24]byte)(&arg.Nonce), (*[32]byte)(&arg.PeersPublicKey),
		(*[32]byte)(kp.Private))
	if !ok {
		err = libkb.DecryptionError{}
		return
	}

	if len(decryptedData) != len(bytes32) {
		err = libkb.DecryptionError{}
		return
	}

	copy(bytes32[:], decryptedData)
	return
}
