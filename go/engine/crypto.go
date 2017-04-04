// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/net/context"
)

// getKeyMu synchronizes all accesses to the need to pull in pinentries/secret keys
// for this user.
var getKeyMu sync.Mutex

func GetMySecretKey(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI, secretKeyType libkb.SecretKeyType, reason string) (libkb.GenericKey, error) {

	g.Log.CDebugf(ctx, "GetMySecretKey: acquiring lock")
	getKeyMu.Lock()
	defer func() {
		getKeyMu.Unlock()
		g.Log.CDebugf(ctx, "GetMySecretKey: lock released")
	}()
	g.Log.CDebugf(ctx, "GetMySecretKey: lock acquired")

	// check ActiveDevice cache after acquiring lock
	key, err := g.ActiveDevice.KeyByType(secretKeyType)
	if err != nil {
		return nil, err
	}
	if key != nil {
		g.Log.CDebugf(ctx, "found cached device key in ActiveDevice")
		return key, nil
	}

	/*
		var err error
		aerr := g.LoginState().Account(func(a *libkb.Account) {
			key, err = a.CachedSecretKey(libkb.SecretKeyArg{KeyType: secretKeyType})
		}, "Keyrings - cachedSecretKey")
		if key != nil && err == nil {
			return key, nil
		}
		if aerr != nil {
			g.Log.CDebugf(ctx, "error getting account for CachedSecretKey: %s", aerr)
		}
	*/

	var me *libkb.User
	err = g.GetFullSelfer().WithSelf(ctx, func(tmp *libkb.User) error {
		me = tmp.PartialCopy()
		return nil
	})
	if err != nil {
		return nil, err
	}

	arg := libkb.SecretKeyPromptArg{
		Ska: libkb.SecretKeyArg{
			Me:      me,
			KeyType: secretKeyType,
		},
		SecretUI:       getSecretUI(),
		Reason:         reason,
		UseCancelCache: true,
	}
	return g.Keyrings.GetSecretKeyWithPrompt(arg)
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

	sig := *kp.Private.Sign(arg.Msg)
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

	var sigInfo *libkb.NaclSigInfo
	sigInfo, err = kp.SignV2(arg.Msg, libkb.SignaturePrefixKBFS)
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
func UnboxBytes32Any(ctx context.Context, g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg) (res keybase1.UnboxAnyRes, err error) {
	defer g.CTrace(ctx, "UnboxBytes32Any", func() error { return err })()

	// find a matching secret key for a bundle in arg.Bundles
	key, index, err := getMatchingSecretKey(g, getSecretUI, arg)
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

func getMatchingSecretKey(g *libkb.GlobalContext, getSecretUI func() libkb.SecretUI, arg keybase1.UnboxBytes32AnyArg) (key libkb.GenericKey, index int, err error) {
	// first check cached keys
	key, index, err = matchingCachedKey(g, arg)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}

	g.Log.Debug("getMatchingSecretKey: acquiring lock")
	getKeyMu.Lock()
	defer func() {
		getKeyMu.Unlock()
		g.Log.Debug("getMatchingSecretKey: lock released")
	}()
	g.Log.Debug("getMatchingSecretKey: lock acquired")

	// check cache after acquiring lock
	key, index, err = matchingCachedKey(g, arg)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}
	g.Log.Debug("getMatchingSecretKey: no matching cached device key found")

	// load the user
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return nil, 0, err
	}

	// need secretUI now:
	secretUI := getSecretUI()

	// check the device key for this user
	key, index, err = matchingDeviceKey(g, secretUI, arg, me)
	if err != nil {
		return nil, 0, err
	}
	if key != nil {
		return key, index, nil
	}
	g.Log.Debug("getMatchingSecretKey: no matching device key found")

	if !arg.PromptPaper {
		g.Log.Debug("UnboxBytes32Any/getMatchingSecretKey: not checking paper keys (promptPaper == false)")
		return nil, 0, libkb.NoSecretKeyError{}
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
	// check device key first
	dkey := g.ActiveDevice.EncryptionKey()
	if dkey != nil {
		if n, ok := kidMatch(dkey, arg.Bundles); ok {
			return dkey, n, nil
		}

	}

	err = g.LoginState().Account(func(a *libkb.Account) {
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
			parg := libkb.SecretKeyPromptArg{
				Ska: libkb.SecretKeyArg{
					Me:      me,
					KeyType: libkb.DeviceEncryptionKeyType,
				},
				SecretUI:       secretUI,
				Reason:         arg.Reason,
				UseCancelCache: true,
			}
			key, err := g.Keyrings.GetSecretKeyWithPrompt(parg)
			if err != nil {
				return nil, 0, err
			}
			return key, n, nil
		}

		g.Log.Debug("matchingDeviceKey: no match found for ekey in arg.Bundles")
		logNoMatch(g, ekey, arg.Bundles)
	} else {
		g.Log.Debug("matchingDeviceKey: ignoring error getting device subkey: %s", err)
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

	phrase, err := libkb.GetPaperKeyForCryptoPassphrase(g, secretUI, arg.Reason, matchingPaper)
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

func logNoMatch(g *libkb.GlobalContext, key libkb.GenericKey, bundles []keybase1.CiphertextBundle) {
	if key == nil {
		g.Log.Debug("logNoMatch: key is nil")
		return
	}
	kid := key.GetKID()
	g.Log.Debug("logNoMatch: desired kid: %s", kid)
	for i, bundle := range bundles {
		g.Log.Debug("logNoMatch: kid %d: %s (%v)", i, bundle.Kid, kid.Equal(bundle.Kid))
	}
}
