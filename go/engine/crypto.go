// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sync"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"
)

// getKeyMu synchronizes all accesses to the need to pull in pinentries/secret keys
// for this user.
var getKeyMu sync.Mutex

// GetMySecretKey uses ActiveDevice to get a secret key for the current user.
//
// It used to have functionality to load the user and prompt for a passphrase to
// unlock the keys, but that is outdated now.  Either you are logged in and
// have your device keys cached, or you aren't.
//
// If the key isn't found in the ActiveDevice cache, this will return LoginRequiredError.
func GetMySecretKey(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI, secretKeyType libkb.SecretKeyType, reason string) (libkb.GenericKey, error) {
	key, err := g.ActiveDevice.KeyByType(secretKeyType)
	if err != nil {
		if _, ok := err.(libkb.NotFoundError); ok {
			g.Log.CDebugf(ctx, "GetMySecretKey: no device key of type %s in ActiveDevice, returning LoginRequiredError", secretKeyType)
			return nil, libkb.LoginRequiredError{Context: "GetMySecretKey"}
		}
		g.Log.CDebugf(ctx, "GetMySecretKey(%s), unexpected error: %s", secretKeyType, err)
		return nil, err
	}
	return key, nil
}

// SignED25519 signs the given message with the current user's private
// signing key.
func SignED25519(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI, arg keybase1.SignED25519Arg) (ret keybase1.ED25519SignatureInfo, err error) {
	signingKey, err := GetMySecretKey(ctx, g, getSecretUI, libkb.DeviceSigningKeyType, arg.Reason)
	if err != nil {
		return
	}

	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		err = libkb.KeyCannotSignError{}
		return
	}

	sig := kp.Private.Sign(arg.Msg)
	publicKey := kp.Public
	ret = keybase1.ED25519SignatureInfo{
		Sig:       keybase1.ED25519Signature(sig),
		PublicKey: keybase1.ED25519PublicKey(publicKey),
	}
	return
}

// SignED25519ForKBFS signs the given message with the current user's private
// signing key on behalf of KBFS.
func SignED25519ForKBFS(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI, arg keybase1.SignED25519ForKBFSArg) (
	ret keybase1.ED25519SignatureInfo, err error) {
	signingKey, err := GetMySecretKey(ctx, g, getSecretUI, libkb.DeviceSigningKeyType, arg.Reason)
	if err != nil {
		return
	}

	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		err = libkb.KeyCannotSignError{}
		return
	}

	var sigInfo kbcrypto.NaclSigInfo
	sigInfo, err = kp.SignV2(arg.Msg, kbcrypto.SignaturePrefixKBFS)
	if err != nil {
		return
	}
	publicKey := kp.Public
	ret = keybase1.ED25519SignatureInfo{
		Sig:       keybase1.ED25519Signature(sigInfo.Sig),
		PublicKey: keybase1.ED25519PublicKey(publicKey),
	}
	return
}

// SignToString signs the given message with the current user's private
// signing key and outputs the serialized NaclSigInfo string.
func SignToString(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI, arg keybase1.SignToStringArg) (sig string, err error) {
	signingKey, err := GetMySecretKey(ctx, g, getSecretUI, libkb.DeviceSigningKeyType, arg.Reason)
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
func UnboxBytes32(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI, arg keybase1.UnboxBytes32Arg) (bytes32 keybase1.Bytes32, err error) {
	encryptionKey, err := GetMySecretKey(ctx, g, getSecretUI, libkb.DeviceEncryptionKeyType, arg.Reason)
	if err != nil {
		return
	}

	return unboxBytes32(encryptionKey, arg.EncryptedBytes32, arg.Nonce, arg.PeersPublicKey)
}

// UnboxBytes32Any will decrypt any of the KID, ciphertext, nonce
// bundles in arg.Bundles.  Key preference order:  cached device keys,
// cached paper keys, local device key, user-entered paper key.
// It returns the KID and bundle index along with the plaintext.
func UnboxBytes32Any(m libkb.MetaContext, getSecretUI func() libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg) (res keybase1.UnboxAnyRes, err error) {
	defer m.Trace("UnboxBytes32Any", func() error { return err })()

	// find a matching secret key for a bundle in arg.Bundles
	key, index, err := getMatchingSecretKey(m, getSecretUI, arg)
	if err != nil {
		return res, err
	}

	// decrypt the bundle's ciphertext
	plaintext, err := unboxBytes32(key, arg.Bundles[index].Ciphertext, arg.Bundles[index].Nonce, arg.Bundles[index].PublicKey)
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

func getMatchingSecretKey(m libkb.MetaContext, getSecretUI func() libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg) (key libkb.GenericKey, index int, err error) {
	// first check cached keys
	key, index, err = matchingCachedKey(m, arg)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}

	m.Debug("getMatchingSecretKey: acquiring lock")
	getKeyMu.Lock()
	defer func() {
		getKeyMu.Unlock()
		m.Debug("getMatchingSecretKey: lock released")
	}()
	m.Debug("getMatchingSecretKey: lock acquired")

	// check cache after acquiring lock
	key, index, err = matchingCachedKey(m, arg)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}
	m.Debug("getMatchingSecretKey: no matching cached device key found")

	// load the user
	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return nil, 0, err
	}

	// need secretUI now:
	secretUI := getSecretUI()

	// check the device key for this user
	key, index, err = matchingDeviceKey(m, secretUI, arg, me)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}
	m.Debug("getMatchingSecretKey: no matching device key found")

	if !arg.PromptPaper {
		m.Debug("UnboxBytes32Any/getMatchingSecretKey: not checking paper keys (promptPaper == false)")
		return nil, 0, libkb.NoSecretKeyError{}
	}

	// check the paper keys for this user
	key, index, err = matchingPaperKey(m, secretUI, arg, me)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}

	return nil, 0, libkb.NoSecretKeyError{}
}

// check cached keys for arg.Bundles match.
func matchingCachedKey(m libkb.MetaContext, arg keybase1.UnboxBytes32AnyArg) (key libkb.GenericKey, index int, err error) {
	// check device key first
	dkey, err := m.ActiveDevice().EncryptionKey()
	if err == nil && dkey != nil {
		if n, ok := kidMatch(dkey, arg.Bundles); ok {
			return dkey, n, nil
		}
	}

	device := m.ActiveDevice().ProvisioningKey(m)
	if device != nil {
		pkey := device.EncryptionKey()
		if n, ok := kidMatch(pkey, arg.Bundles); ok {
			return pkey, n, nil
		}
	}
	return nil, 0, nil
}

// check device key for arg.Bundles match.
func matchingDeviceKey(m libkb.MetaContext, secretUI libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg, me *libkb.User) (key libkb.GenericKey, index int, err error) {
	ekey, err := me.GetDeviceSubkey()
	if err == nil {
		if n, ok := kidMatch(ekey, arg.Bundles); ok {
			// unlock this key
			parg := libkb.SecretKeyPromptArg{
				Ska: libkb.SecretKeyArg{
					Me:      me,
					KeyType: libkb.DeviceEncryptionKeyType,
				},
				SecretUI:       secretUI,
				Reason:         arg.Reason,
				UseCancelCache: true,
			}
			key, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, parg)
			if err != nil {
				return nil, 0, err
			}
			return key, n, nil
		}

		m.Debug("matchingDeviceKey: no match found for ekey in arg.Bundles")
		logNoMatch(m, ekey, arg.Bundles)
	} else {
		m.Debug("matchingDeviceKey: ignoring error getting device subkey: %s", err)
	}

	return nil, 0, nil
}

// check all the user's paper keys for arg.Bundles match
func matchingPaperKey(m libkb.MetaContext, secretUI libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg, me *libkb.User) (key libkb.GenericKey, index int, err error) {
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
			m.Debug("matching paper key: %s", *pdev.Description)
			matchingPaper = append(matchingPaper, pdev)
		}
	}
	if len(matchingPaper) == 0 {
		m.Debug("no matching paper keys found")
		return nil, 0, nil
	}

	phrase, err := libkb.GetPaperKeyForCryptoPassphrase(m, secretUI, arg.Reason, matchingPaper)
	if err != nil {
		return nil, 0, err
	}
	paperPhrase, err := libkb.NewPaperKeyPhraseCheckVersion(m, phrase)
	if err != nil {
		return nil, 0, err
	}

	bkarg := &PaperKeyGenArg{
		Passphrase: paperPhrase,
		SkipPush:   true,
	}
	bkeng := NewPaperKeyGen(m.G(), bkarg)
	if err := RunEngine2(m, bkeng); err != nil {
		return nil, 0, err
	}

	// find the index for the key they entered (and make sure the key they entered matches)
	if n, ok := kidMatch(bkeng.EncKey(), arg.Bundles); ok {
		m.ActiveDevice().CacheProvisioningKey(m, bkeng.DeviceWithKeys())
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

func logNoMatch(m libkb.MetaContext, key libkb.GenericKey, bundles []keybase1.CiphertextBundle) {
	if key == nil {
		m.Debug("logNoMatch: key is nil")
		return
	}
	kid := key.GetKID()
	m.Debug("logNoMatch: desired kid: %s", kid)
	for i, bundle := range bundles {
		m.Debug("logNoMatch: kid %d: %s (%v)", i, bundle.Kid, kid.Equal(bundle.Kid))
	}
}
