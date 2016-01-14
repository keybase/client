// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

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

// SignToString signs the given message with the current user's private
// signing key and outputs the serialized NaclSigInfo string.
func SignToString(g *libkb.GlobalContext, secretUI libkb.SecretUI,
	arg keybase1.SignToStringArg) (
	sig string, err error) {
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

	sig, _, err = kp.SignToString(arg.Msg)
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

	return unboxBytes32(encryptionKey, arg.EncryptedBytes32, arg.Nonce, arg.PeersPublicKey)
}

// UnboxBytes32Any will decrypt any of the KID, ciphertext, nonce
// bundles in arg.Bundles.  Key preference order:  cached device keys,
// cached paper keys, local device key, user-entered paper key.
// It returns the KID and bundle index along with the plaintext.
func UnboxBytes32Any(g *libkb.GlobalContext, secretUI libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg) (res keybase1.UnboxAnyRes, err error) {
	defer g.Trace("UnboxBytes32Any", func() error { return err })

	// find a matching secret key for a bundle in arg.Bundles
	key, index, err := getMatchingSecretKey(g, secretUI, arg)
	if err != nil {
		return res, err
	}

	// decrypt the bundle's ciphertext
	plaintext, err := unboxBytes32(key, arg.Bundles[index].Ciphertext, arg.Bundles[index].Nonce, arg.Bundles[index].EPublicKey)
	if err != nil {
		return res, err
	}

	// return plaintext, kid, and index
	res.Plaintext = plaintext
	res.Kid = key.GetKID()
	res.Index = index

	return res, nil
}

func unboxBytes32(encryptionKey libkb.GenericKey, ciphertext keybase1.EncryptedBytes32, nonce keybase1.BoxNonce, peerPubKey keybase1.BoxPublicKey) (bytes32 keybase1.Bytes32, err error) {
	kp, ok := encryptionKey.(libkb.NaclDHKeyPair)
	if !ok {
		err = libkb.KeyCannotDecryptError{}
		return
	}
	if kp.Private == nil {
		err = libkb.NoSecretKeyError{}
		return
	}

	decryptedData, ok := box.Open(nil, ciphertext[:], (*[24]byte)(&nonce), (*[32]byte)(&peerPubKey), (*[32]byte)(kp.Private))
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

func getMatchingSecretKey(g *libkb.GlobalContext, secretUI libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg) (key libkb.GenericKey, index int, err error) {
	// first check cached keys
	key, index, err = matchingCachedKey(g, arg)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}

	// load the user
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return nil, 0, err
	}

	// check the device key for this user
	key, index, err = matchingDeviceKey(g, secretUI, arg, me)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}

	// check the paper keys for this user
	key, index, err = matchingPaperKey(g, secretUI, arg, me)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}

	return nil, 0, libkb.NoSecretKeyError{}
}

// check cached keys for arg.Bundles match.
func matchingCachedKey(g *libkb.GlobalContext, arg keybase1.UnboxBytes32AnyArg) (key libkb.GenericKey, index int, err error) {
	err = g.LoginState().Account(func(a *libkb.Account) {
		// check device key first
		dkey, err := a.CachedSecretKey(libkb.SecretKeyArg{KeyType: libkb.DeviceEncryptionKeyType})
		if err == nil {
			if n, ok := kidMatch(dkey, arg.Bundles); ok {
				key = dkey
				index = n
				return
			}
		}

		// check paper key
		pkey := a.GetUnlockedPaperEncKey()
		if n, ok := kidMatch(pkey, arg.Bundles); ok {
			key = pkey
			index = n
			return
		}
	}, "UnboxBytes32Any")
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}

	return nil, 0, nil
}

// check device key for arg.Bundles match.
func matchingDeviceKey(g *libkb.GlobalContext, secretUI libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg, me *libkb.User) (key libkb.GenericKey, index int, err error) {
	ekey, err := me.GetDeviceSubkey()
	if err == nil {
		if n, ok := kidMatch(ekey, arg.Bundles); ok {
			// unlock this key
			skarg := libkb.SecretKeyArg{
				Me:      me,
				KeyType: libkb.DeviceEncryptionKeyType,
			}
			key, err := g.Keyrings.GetSecretKeyWithPrompt(nil, skarg, secretUI, arg.Reason)
			if err != nil {
				return nil, 0, err
			}
			return key, n, nil
		}
	}

	return nil, 0, nil
}

// check all the user's paper keys for arg.Bundles match
func matchingPaperKey(g *libkb.GlobalContext, secretUI libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg, me *libkb.User) (key libkb.GenericKey, index int, err error) {
	cki := me.GetComputedKeyInfos()
	if cki == nil {
		return nil, 0, nil
	}
	var matchingPaper []*libkb.Device
	for _, pdev := range cki.PaperDevices() {
		enckey, err := me.GetComputedKeyFamily().GetEncryptionSubkeyForDevice(pdev.ID)
		if err != nil {
			return nil, 0, err
		}
		if _, ok := kidMatch(enckey, arg.Bundles); ok {
			g.Log.Debug("matching paper key: %s", *pdev.Description)
			matchingPaper = append(matchingPaper, pdev)
		}
	}
	if len(matchingPaper) == 0 {
		g.Log.Debug("no matching paper keys found")
		return nil, 0, nil
	}

	phrase, err := libkb.GetPaperKeyForCryptoPassphrase(secretUI, arg.Reason, matchingPaper)
	if err != nil {
		return nil, 0, err
	}
	paperPhrase, err := libkb.NewPaperKeyPhraseCheckVersion(g, phrase)
	if err != nil {
		return nil, 0, err
	}

	bkarg := &PaperKeyGenArg{
		Passphrase: paperPhrase,
		SkipPush:   true,
	}
	bkeng := NewPaperKeyGen(bkarg, g)
	if err := RunEngine(bkeng, &Context{}); err != nil {
		return nil, 0, err
	}

	// find the index for the key they entered (and make sure the key they entered matches)
	if n, ok := kidMatch(bkeng.EncKey(), arg.Bundles); ok {

		// this key matches, so cache this paper key
		if err := g.LoginState().Account(func(a *libkb.Account) {
			a.SetUnlockedPaperKey(bkeng.SigKey(), bkeng.EncKey())
		}, "UnboxBytes32Any - cache paper key"); err != nil {
			return nil, 0, err
		}

		return bkeng.EncKey(), n, nil
	}

	return nil, 0, nil
}

func kidMatch(key libkb.GenericKey, bundles []keybase1.CiphertextBundle) (int, bool) {
	if key == nil {
		return -1, false
	}
	kid := key.GetKID()
	for i, bundle := range bundles {
		if kid.Equal(bundle.Kid) {
			return i, true
		}
	}
	return -1, false
}
