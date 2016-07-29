// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// KeyManagerStandard implements the KeyManager interface by fetching
// keys from KeyOps and KBPKI, and computing the complete keys
// necessary to run KBFS.
type KeyManagerStandard struct {
	config   Config
	log      logger.Logger
	deferLog logger.Logger
}

// NewKeyManagerStandard returns a new KeyManagerStandard
func NewKeyManagerStandard(config Config) *KeyManagerStandard {
	log := config.MakeLogger("")
	return &KeyManagerStandard{config, log, log.CloneWithAddedDepth(1)}
}

// GetTLFCryptKeyForEncryption implements the KeyManager interface for
// KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForEncryption(ctx context.Context,
	kmd KeyMetadata) (tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKeyUsingCurrentDevice(ctx, kmd,
		kmd.LatestKeyGeneration(), false)
}

// GetTLFCryptKeyForMDDecryption implements the KeyManager interface
// for KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForMDDecryption(
	ctx context.Context, kmdToDecrypt, kmdWithKeys KeyMetadata) (
	tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKey(ctx, kmdWithKeys, kmdToDecrypt.LatestKeyGeneration(),
		getTLFCryptKeyAnyDevice|getTLFCryptKeyDoCache)
}

// GetTLFCryptKeyForBlockDecryption implements the KeyManager interface for
// KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForBlockDecryption(
	ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer) (
	tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKeyUsingCurrentDevice(ctx, kmd, blockPtr.KeyGen, true)
}

func (km *KeyManagerStandard) getTLFCryptKeyUsingCurrentDevice(
	ctx context.Context, kmd KeyMetadata, keyGen KeyGen, cache bool) (
	tlfCryptKey TLFCryptKey, err error) {
	flags := getTLFCryptKeyFlags(0)
	if cache {
		flags = getTLFCryptKeyDoCache
	}
	return km.getTLFCryptKey(ctx, kmd, keyGen, flags)
}

type getTLFCryptKeyFlags byte

const (
	getTLFCryptKeyAnyDevice getTLFCryptKeyFlags = 1 << iota
	getTLFCryptKeyDoCache
	getTLFCryptKeyPromptPaper
)

func (km *KeyManagerStandard) getTLFCryptKey(ctx context.Context,
	kmd KeyMetadata, keyGen KeyGen, flags getTLFCryptKeyFlags) (
	TLFCryptKey, error) {
	tlfID := kmd.TlfID()

	if tlfID.IsPublic() {
		return PublicTLFCryptKey, nil
	}

	if keyGen < FirstValidKeyGen {
		return TLFCryptKey{}, InvalidKeyGenerationError{tlfID, keyGen}
	}
	// Is this some key we don't know yet?  Shouldn't really ever happen,
	// since we must have seen the MD that led us to this block, which
	// should include all the latest keys.  Consider this a failsafe.
	if keyGen > kmd.LatestKeyGeneration() {
		return TLFCryptKey{}, NewKeyGenerationError{tlfID, keyGen}
	}

	// look in the cache first
	kcache := km.config.KeyCache()
	tlfCryptKey, err := kcache.GetTLFCryptKey(tlfID, keyGen)
	switch err := err.(type) {
	case nil:
		return tlfCryptKey, nil
	case KeyCacheMissError:
		break
	default:
		return TLFCryptKey{}, err
	}

	// Get the encrypted version of this secret key for this device
	kbpki := km.config.KBPKI()
	username, uid, err := kbpki.GetCurrentUserInfo(ctx)
	if err != nil {
		return TLFCryptKey{}, err
	}

	localMakeRekeyReadError := func() error {
		return makeRekeyReadError(ctx, km.config, kmd, keyGen, uid, username)
	}

	var clientHalf TLFCryptKeyClientHalf
	var serverHalfID TLFCryptKeyServerHalfID
	var cryptPublicKey CryptPublicKey
	crypto := km.config.Crypto()

	if flags&getTLFCryptKeyAnyDevice != 0 {
		publicKeys, err := kbpki.GetCryptPublicKeys(ctx, uid)
		if err != nil {
			return TLFCryptKey{}, err
		}

		keys := make([]EncryptedTLFCryptKeyClientAndEphemeral, 0,
			len(publicKeys))
		serverHalfIDs := make([]TLFCryptKeyServerHalfID, 0, len(publicKeys))
		publicKeyLookup := make([]int, 0, len(publicKeys))

		for i, k := range publicKeys {
			ePublicKey, encryptedClientHalf, serverHalfID, found, err := kmd.GetTLFCryptKeyParams(keyGen, uid, k)
			if err != nil {
				km.log.CDebugf(ctx, "Got error for GetTLFCryptKeyParams(%d, %v, %v); skipping: %v", keyGen, uid, k, err)
				continue
			}
			if !found {
				km.log.CDebugf(ctx, "Could not find key info for(%d, %v, %v); skipping", keyGen, uid, k)
				continue
			}

			serverHalfIDs = append(serverHalfIDs, serverHalfID)
			keys = append(keys, EncryptedTLFCryptKeyClientAndEphemeral{
				PubKey:     k,
				ClientHalf: encryptedClientHalf,
				EPubKey:    ePublicKey,
			})
			publicKeyLookup = append(publicKeyLookup, i)
		}
		if len(keys) == 0 {
			return TLFCryptKey{}, localMakeRekeyReadError()
		}
		var index int
		clientHalf, index, err = crypto.DecryptTLFCryptKeyClientHalfAny(ctx,
			keys, flags&getTLFCryptKeyPromptPaper != 0)
		_, isDecryptError := err.(libkb.DecryptionError)
		_, isNoKeyError := err.(libkb.NoSecretKeyError)
		if isDecryptError || isNoKeyError {
			km.log.CDebugf(ctx, "Got decryption error from service: %v", err)
			return TLFCryptKey{}, localMakeRekeyReadError()
		} else if err != nil {
			return TLFCryptKey{}, err
		}
		serverHalfID = serverHalfIDs[index]
		cryptPublicKey = publicKeys[publicKeyLookup[index]]
	} else {
		cryptPublicKey, err = kbpki.GetCurrentCryptPublicKey(ctx)
		if err != nil {
			return TLFCryptKey{}, err
		}

		ePublicKey, encryptedClientHalf, foundServerHalfID, found, err :=
			kmd.GetTLFCryptKeyParams(keyGen, uid, cryptPublicKey)
		if err != nil {
			return TLFCryptKey{}, err
		} else if !found {
			return TLFCryptKey{}, localMakeRekeyReadError()
		}

		clientHalf, err = crypto.DecryptTLFCryptKeyClientHalf(
			ctx, ePublicKey, encryptedClientHalf)
		if err != nil {
			return TLFCryptKey{}, err
		}

		serverHalfID = foundServerHalfID
	}

	// get the server-side key-half, do the unmasking, possibly cache the result, return
	// TODO: can parallelize the get() with decryption
	kops := km.config.KeyOps()
	serverHalf, err := kops.GetTLFCryptKeyServerHalf(ctx, serverHalfID,
		cryptPublicKey)
	if err != nil {
		return TLFCryptKey{}, err
	}

	tlfCryptKey, err = crypto.UnmaskTLFCryptKey(serverHalf, clientHalf)
	if err != nil {
		return TLFCryptKey{}, err
	}

	if flags&getTLFCryptKeyDoCache != 0 {
		if err = kcache.PutTLFCryptKey(tlfID, keyGen, tlfCryptKey); err != nil {
			return TLFCryptKey{}, err
		}
	}

	return tlfCryptKey, nil
}

func (km *KeyManagerStandard) updateKeyBundle(ctx context.Context,
	md *RootMetadata, keyGen KeyGen, wKeys map[keybase1.UID][]CryptPublicKey,
	rKeys map[keybase1.UID][]CryptPublicKey, ePubKey TLFEphemeralPublicKey,
	ePrivKey TLFEphemeralPrivateKey, tlfCryptKey TLFCryptKey) error {
	wkb, rkb, err := md.getTLFKeyBundles(keyGen)
	if err != nil {
		return err
	}

	newServerKeys, err := fillInDevices(km.config.Crypto(),
		wkb, rkb, wKeys, rKeys,
		ePubKey, ePrivKey, tlfCryptKey)
	if err != nil {
		return err
	}

	// Push new keys to the key server.
	if err = km.config.KeyOps().
		PutTLFCryptKeyServerHalves(ctx, newServerKeys); err != nil {
		return err
	}

	return nil
}

func (km *KeyManagerStandard) usersWithNewDevices(ctx context.Context,
	tlfID TlfID, keyInfoMap UserDeviceKeyInfoMap,
	expectedKeys map[keybase1.UID][]CryptPublicKey) map[keybase1.UID]bool {
	users := make(map[keybase1.UID]bool)
	for u, keys := range expectedKeys {
		kids, ok := keyInfoMap[u]
		if !ok {
			// Currently there probably shouldn't be any new users
			// in the handle, but don't error just in case we ever
			// want to support that in the future.
			km.log.CInfof(ctx, "Rekey %s: adding new user %s", tlfID, u)
			users[u] = true
			continue
		}
		for _, k := range keys {
			km.log.CDebugf(ctx, "Checking key %v", k.kid)
			if _, ok := kids[k.kid]; !ok {
				km.log.CInfof(ctx, "Rekey %s: adding new device %s for user %s",
					tlfID, k.kid, u)
				users[u] = true
				break
			}
		}
	}
	return users
}

func (km *KeyManagerStandard) usersWithRemovedDevices(ctx context.Context,
	tlfID TlfID, keyInfoMap UserDeviceKeyInfoMap,
	expectedKeys map[keybase1.UID][]CryptPublicKey) map[keybase1.UID]bool {
	users := make(map[keybase1.UID]bool)
	for u, kids := range keyInfoMap {
		keys, ok := expectedKeys[u]
		if !ok {
			// Currently there probably shouldn't be any users removed
			// from the handle, but don't error just in case we ever
			// want to support that in the future.
			km.log.CInfof(ctx, "Rekey %s: removing user %s", tlfID, u)
			users[u] = true
			continue
		}
		keyLookup := make(map[keybase1.KID]bool)
		for _, key := range keys {
			keyLookup[key.kid] = true
		}
		for kid := range kids {
			// Make sure every kid has an expected key
			if !keyLookup[kid] {
				km.log.CInfof(ctx,
					"Rekey %s: removing device %s for user %s", tlfID, kid, u)
				users[u] = true
				break
			}
		}
	}
	return users
}

func (km *KeyManagerStandard) deleteKeysForRemovedDevices(ctx context.Context,
	md *RootMetadata, info UserDeviceKeyInfoMap,
	expectedKeys map[keybase1.UID][]CryptPublicKey) error {
	kops := km.config.KeyOps()
	var usersToDelete []keybase1.UID
	for u, kids := range info {
		keys, ok := expectedKeys[u]
		if !ok {
			// The user was completely removed from the handle, which
			// shouldn't happen but might as well make it work just in
			// case.
			km.log.CInfof(ctx, "Rekey %s: removing all server key halves "+
				"for user %s", md.ID, u)
			usersToDelete = append(usersToDelete, u)
			for kid, keyInfo := range kids {
				err := kops.DeleteTLFCryptKeyServerHalf(ctx, u, kid,
					keyInfo.ServerHalfID)
				if err != nil {
					return err
				}
			}
			continue
		}
		keyLookup := make(map[keybase1.KID]bool)
		for _, key := range keys {
			keyLookup[key.KID()] = true
		}
		var toRemove []keybase1.KID
		for kid, keyInfo := range kids {
			// Remove any keys that no longer belong.
			if !keyLookup[kid] {
				toRemove = append(toRemove, kid)
				km.log.CInfof(ctx, "Rekey %s: removing server key halves "+
					" for device %s of user %s", md.ID, kid, u)
				err := kops.DeleteTLFCryptKeyServerHalf(ctx, u, kid,
					keyInfo.ServerHalfID)
				if err != nil {
					return err
				}
			}
		}
		for _, kid := range toRemove {
			delete(info[u], kid)
		}
	}

	for _, u := range usersToDelete {
		delete(info, u)
	}

	return nil
}

func (km *KeyManagerStandard) identifyUIDSets(ctx context.Context,
	tlfID TlfID, writersToIdentify map[keybase1.UID]bool,
	readersToIdentify map[keybase1.UID]bool) error {
	uids := make([]keybase1.UID, 0, len(writersToIdentify)+len(readersToIdentify))
	for u := range writersToIdentify {
		uids = append(uids, u)
	}
	for u := range readersToIdentify {
		uids = append(uids, u)
	}
	kbpki := km.config.KBPKI()
	return identifyUserList(ctx, kbpki, kbpki, uids, tlfID.IsPublic())
}

func (km *KeyManagerStandard) generateKeyMapForUsers(ctx context.Context, users []keybase1.UID) (map[keybase1.UID][]CryptPublicKey, error) {
	keyMap := make(map[keybase1.UID][]CryptPublicKey)

	// TODO: parallelize
	for _, w := range users {
		// HACK: clear cache
		km.config.KeybaseDaemon().FlushUserFromLocalCache(ctx, w)
		publicKeys, err := km.config.KBPKI().GetCryptPublicKeys(ctx, w)
		if err != nil {
			return nil, err
		}
		keyMap[w] = publicKeys
	}

	return keyMap, nil
}

// Rekey implements the KeyManager interface for KeyManagerStandard.
// TODO make this less terrible.
func (km *KeyManagerStandard) Rekey(ctx context.Context, md *RootMetadata, promptPaper bool) (
	rekeyDone bool, cryptKey *TLFCryptKey, err error) {
	km.log.CDebugf(ctx, "Rekey %s (prompt for paper key: %t)",
		md.ID, promptPaper)
	defer func() { km.deferLog.CDebugf(ctx, "Rekey %s done: %#v", md.ID, err) }()

	currKeyGen := md.LatestKeyGeneration()
	if md.ID.IsPublic() != (currKeyGen == PublicKeyGen) {
		return false, nil, fmt.Errorf(
			"ID %v has isPublic=%t but currKeyGen is %d (isPublic=%t)",
			md.ID, md.ID.IsPublic(), currKeyGen, currKeyGen == PublicKeyGen)
	}

	if promptPaper && md.ID.IsPublic() {
		return false, nil, fmt.Errorf("promptPaper set for public TLF %v", md.ID)
	}

	handle := md.GetTlfHandle()

	username, uid, err := km.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return false, nil, err
	}

	resolvedHandle, err := handle.ResolveAgain(ctx, km.config.KBPKI())
	if err != nil {
		return false, nil, err
	}

	isWriter := resolvedHandle.IsWriter(uid)
	if !md.ID.IsPublic() && !isWriter {
		// If I was already a reader, there's nothing more to do
		if handle.IsReader(uid) {
			resolvedHandle = handle
			km.log.CDebugf(ctx, "Local user is not a writer, and was "+
				"already a reader; reverting back to the original handle")
		} else {
			// Only allow yourself to change
			resolvedHandle, err =
				handle.ResolveAgainForUser(ctx, km.config.KBPKI(), uid)
			if err != nil {
				return false, nil, err
			}
		}
	}

	eq, err := handle.Equals(km.config.Codec(), *resolvedHandle)
	if err != nil {
		return false, nil, err
	}
	handleChanged := !eq
	if handleChanged {
		km.log.CDebugf(ctx, "handle for %s resolved to %s",
			handle.GetCanonicalPath(),
			resolvedHandle.GetCanonicalPath())

		// Check with the server to see if the handle became a conflict.
		latestHandle, err := km.config.MDOps().GetLatestHandleForTLF(ctx, md.ID)
		if latestHandle.ConflictInfo != nil {
			km.log.CDebugf(ctx, "handle for %s is conflicted",
				handle.GetCanonicalPath())
		}
		err = resolvedHandle.UpdateConflictInfo(
			km.config.Codec(), latestHandle.ConflictInfo)
		if err != nil {
			return false, nil, err
		}
	}

	// For a public TLF there's no rekeying to be done, but we
	// should still update the writer list.
	if md.ID.IsPublic() {
		if !handleChanged {
			km.log.CDebugf(ctx,
				"Skipping rekeying %s (public): handle hasn't changed",
				md.ID)
			return false, nil, nil
		}
		return true, nil, md.updateFromTlfHandle(resolvedHandle)
	}

	// Decide whether we have a new device and/or a revoked device, or neither.
	// Look up all the device public keys for all writers and readers first.

	incKeyGen := currKeyGen < FirstValidKeyGen

	if !isWriter && incKeyGen {
		// Readers cannot create the first key generation
		return false, nil, NewReadAccessError(resolvedHandle, username)
	}

	// All writer keys in the desired keyset
	wKeys, err := km.generateKeyMapForUsers(ctx, resolvedHandle.ResolvedWriters())
	if err != nil {
		return false, nil, err
	}
	// All reader keys in the desired keyset
	rKeys, err := km.generateKeyMapForUsers(ctx, resolvedHandle.ResolvedReaders())
	if err != nil {
		return false, nil, err
	}

	addNewReaderDevice := false
	addNewWriterDevice := false
	var newReaderUsers map[keybase1.UID]bool
	var newWriterUsers map[keybase1.UID]bool
	var promotedReaders map[keybase1.UID]bool

	// Figure out if we need to add or remove any keys.
	// If we're already incrementing the key generation then we don't need to
	// figure out the key delta.
	addNewReaderDeviceForSelf := false
	if !incKeyGen {
		// See if there is at least one new device in relation to the
		// current key bundle
		wkb, rkb, err := md.getTLFKeyBundles(currKeyGen)
		if err != nil {
			return false, nil, err
		}

		newWriterUsers = km.usersWithNewDevices(ctx, md.ID, wkb.WKeys, wKeys)
		newReaderUsers = km.usersWithNewDevices(ctx, md.ID, rkb.RKeys, rKeys)
		addNewWriterDevice = len(newWriterUsers) > 0
		addNewReaderDevice = len(newReaderUsers) > 0

		wRemoved := km.usersWithRemovedDevices(ctx, md.ID, wkb.WKeys, wKeys)
		rRemoved := km.usersWithRemovedDevices(ctx, md.ID, rkb.RKeys, rKeys)
		incKeyGen = len(wRemoved) > 0 || len(rRemoved) > 0

		promotedReaders = make(map[keybase1.UID]bool, len(rRemoved))

		// Before we add the removed devices, check if we are adding a
		// new reader device for ourselves.
		_, addNewReaderDeviceForSelf = newReaderUsers[uid]

		for u := range rRemoved {
			// FIXME (potential): this could cause a reader to attempt to rekey
			// in the case of a revocation for the currently logged-in user. I
			// _think_ incKeyGen above protects against this, but I'm not
			// confident.
			newReaderUsers[u] = true
			// Track which readers have been promoted. This must happen before
			// the following line adds all the removed writers to the writer
			// set
			if newWriterUsers[u] {
				promotedReaders[u] = true
			}
		}
		for u := range wRemoved {
			newWriterUsers[u] = true
		}

		if err := km.identifyUIDSets(ctx, md.ID, newWriterUsers, newReaderUsers); err != nil {
			return false, nil, err
		}
	}

	if !addNewReaderDevice && !addNewWriterDevice && !incKeyGen &&
		!handleChanged {
		km.log.CDebugf(ctx,
			"Skipping rekeying %s (private): no new or removed devices, no new keygen, and handle hasn't changed",
			md.ID)
		return false, nil, nil
	}

	if !isWriter {
		if _, userHasNewKeys := newReaderUsers[uid]; userHasNewKeys && !promotedReaders[uid] {
			// Only rekey the logged-in reader, and only if that reader isn't being promoted
			rKeys = map[keybase1.UID][]CryptPublicKey{
				uid: rKeys[uid],
			}
			wKeys = nil
			delete(newReaderUsers, uid)
		} else {
			// No new reader device for our user, so the reader can't do
			// anything
			return false, nil, RekeyIncompleteError{}
		}
	}

	// For addNewDevice, we only use the ephemeral keys; incKeyGen
	// needs all of them.  ePrivKey will be discarded at the end of the
	// function in either case.
	//
	// TODO: split MakeRandomTLFKeys into two separate methods.
	pubKey, privKey, ePubKey, ePrivKey, tlfCryptKey, err :=
		km.config.Crypto().MakeRandomTLFKeys()
	if err != nil {
		return false, nil, err
	}

	// If there's at least one new device, add that device to every key bundle.
	if addNewReaderDevice || addNewWriterDevice {
		for keyGen := KeyGen(FirstValidKeyGen); keyGen <= currKeyGen; keyGen++ {
			flags := getTLFCryptKeyAnyDevice
			if promptPaper {
				flags |= getTLFCryptKeyPromptPaper
			}
			currTlfCryptKey, err := km.getTLFCryptKey(ctx, md.ReadOnly(), keyGen, flags)
			if err != nil {
				return false, nil, err
			}

			// If there are readers that need to be promoted to writers, do
			// that here.
			wkb, rkb, err := md.getTLFKeyBundles(keyGen)
			if err != nil {
				return false, nil, err
			}
			for u := range promotedReaders {
				wkb.WKeys[u] = rkb.RKeys[u]
				delete(rkb.RKeys, u)
			}

			err = km.updateKeyBundle(ctx, md, keyGen, wKeys, rKeys,
				ePubKey, ePrivKey, currTlfCryptKey)
			if err != nil {
				return false, nil, err
			}
		}
	}

	// Make sure the private MD is decrypted if it wasn't already.  We
	// have to do this here, before adding a new key generation, since
	// decryptMDPrivateData assumes that the MD is always encrypted
	// using the latest key gen.
	if !md.IsReadable() && len(md.SerializedPrivateMetadata) > 0 {
		if err := decryptMDPrivateData(ctx, km.config, md, md.ReadOnly()); err != nil {
			return false, nil, err
		}
	}

	defer func() {
		// On our way back out, update the md with the resolved handle
		// if at least part of a rekey was performed.
		_, isRekeyIncomplete := err.(RekeyIncompleteError)
		if err == nil || isRekeyIncomplete {
			updateErr := md.updateFromTlfHandle(resolvedHandle)
			if updateErr != nil {
				err = updateErr
			}
		}
	}()

	if !isWriter {
		if len(newReaderUsers) > 0 || addNewWriterDevice || incKeyGen {
			// If we're a reader but we haven't completed all the work, return
			// RekeyIncompleteError.
			return addNewReaderDeviceForSelf, nil, RekeyIncompleteError{}
		}
		// Otherwise, there's nothing left to do!
		return true, nil, nil
	} else if !incKeyGen {
		// we're done!
		return true, nil, nil
	}

	// Send rekey start notification once we're sure that this device
	// can perform the rekey.
	km.config.Reporter().Notify(ctx, rekeyNotification(ctx, km.config, resolvedHandle,
		false))

	newWriterKeys := TLFWriterKeyBundle{
		WKeys:        make(UserDeviceKeyInfoMap),
		TLFPublicKey: pubKey,
		// TLFEphemeralPublicKeys will be filled in by updateKeyBundle
	}
	newReaderKeys := TLFReaderKeyBundle{
		RKeys: make(UserDeviceKeyInfoMap),
		// TLFReaderEphemeralPublicKeys will be filled in by updateKeyBundle
	}
	err = md.AddNewKeys(newWriterKeys, newReaderKeys)
	if err != nil {
		return false, nil, err
	}
	currKeyGen = md.LatestKeyGeneration()
	err = km.updateKeyBundle(ctx, md, currKeyGen, wKeys, rKeys, ePubKey,
		ePrivKey, tlfCryptKey)
	if err != nil {
		return false, nil, err
	}
	md.data.TLFPrivateKey = privKey

	// Delete server-side key halves for any revoked devices.
	for keygen := KeyGen(FirstValidKeyGen); keygen <= currKeyGen; keygen++ {
		wkb, rkb, err := md.getTLFKeyBundles(keygen)
		if err != nil {
			return false, nil, err
		}

		err = km.deleteKeysForRemovedDevices(ctx, md, wkb.WKeys, wKeys)
		if err != nil {
			return false, nil, err
		}
		err = km.deleteKeysForRemovedDevices(ctx, md, rkb.RKeys, rKeys)
		if err != nil {
			return false, nil, err
		}
	}

	return true, &tlfCryptKey, nil
}
