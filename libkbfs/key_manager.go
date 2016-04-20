package libkbfs

import (
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// KeyManagerStandard implements the KeyManager interface by fetching
// keys from KeyOps and KBPKI, and computing the complete keys
// necessary to run KBFS.
type KeyManagerStandard struct {
	config Config
	log    logger.Logger
}

// NewKeyManagerStandard returns a new KeyManagerStandard
func NewKeyManagerStandard(config Config) *KeyManagerStandard {
	return &KeyManagerStandard{config, config.MakeLogger("")}
}

// GetTLFCryptKeyForEncryption implements the KeyManager interface for
// KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForEncryption(ctx context.Context,
	md *RootMetadata) (tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKeyUsingCurrentDevice(ctx, md,
		md.LatestKeyGeneration(), false)
}

// GetTLFCryptKeyForMDDecryption implements the KeyManager interface
// for KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForMDDecryption(
	ctx context.Context, md *RootMetadata) (
	tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKey(ctx, md, md.LatestKeyGeneration(),
		getTLFCryptKeyAnyDevice|getTLFCryptKeyDoCache)
}

// GetTLFCryptKeyForBlockDecryption implements the KeyManager interface for
// KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForBlockDecryption(
	ctx context.Context, md *RootMetadata, blockPtr BlockPointer) (
	tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKeyUsingCurrentDevice(ctx, md, blockPtr.KeyGen, true)
}

func (km *KeyManagerStandard) getTLFCryptKeyUsingCurrentDevice(
	ctx context.Context, md *RootMetadata, keyGen KeyGen, cache bool) (
	tlfCryptKey TLFCryptKey, err error) {
	flags := getTLFCryptKeyFlags(0)
	if cache {
		flags = getTLFCryptKeyDoCache
	}
	return km.getTLFCryptKey(ctx, md, keyGen, flags)
}

type getTLFCryptKeyFlags byte

const (
	getTLFCryptKeyAnyDevice getTLFCryptKeyFlags = 1 << iota
	getTLFCryptKeyDoCache
	getTLFCryptKeyPromptPaper
)

func (km *KeyManagerStandard) getTLFCryptKey(ctx context.Context,
	md *RootMetadata, keyGen KeyGen, flags getTLFCryptKeyFlags) (
	tlfCryptKey TLFCryptKey, err error) {

	if md.ID.IsPublic() {
		tlfCryptKey = PublicTLFCryptKey
		return
	}

	if keyGen < FirstValidKeyGen {
		err = InvalidKeyGenerationError{md.GetTlfHandle(), keyGen}
		return
	}
	// Is this some key we don't know yet?  Shouldn't really ever happen,
	// since we must have seen the MD that led us to this block, which
	// should include all the latest keys.  Consider this a failsafe.
	if keyGen > md.LatestKeyGeneration() {
		err = NewKeyGenerationError{md.GetTlfHandle(), keyGen}
		return
	}

	// look in the cache first
	kcache := km.config.KeyCache()
	if tlfCryptKey, err = kcache.GetTLFCryptKey(md.ID, keyGen); err == nil {
		return
	}

	// Get the encrypted version of this secret key for this device
	kbpki := km.config.KBPKI()
	username, uid, err := kbpki.GetCurrentUserInfo(ctx)
	if err != nil {
		return
	}

	var clientHalf TLFCryptKeyClientHalf
	var info TLFCryptKeyInfo
	var cryptPublicKey CryptPublicKey
	crypto := km.config.Crypto()

	if flags&getTLFCryptKeyAnyDevice != 0 {
		publicKeys, err := kbpki.GetCryptPublicKeys(ctx, uid)
		if err != nil {
			return tlfCryptKey, err
		}

		keys := make([]EncryptedTLFCryptKeyClientAndEphemeral, 0,
			len(publicKeys))
		keysInfo := make([]TLFCryptKeyInfo, 0, len(publicKeys))
		publicKeyLookup := make([]int, 0, len(publicKeys))

		for i, k := range publicKeys {
			info, ok, _ := md.GetTLFCryptKeyInfo(keyGen, uid, k)
			if ok {
				ePublicKey, err := md.GetTLFEphemeralPublicKey(keyGen, uid, k)
				if err != nil {
					continue
				}

				keysInfo = append(keysInfo, info)
				keys = append(keys, EncryptedTLFCryptKeyClientAndEphemeral{
					PubKey:     k,
					ClientHalf: info.ClientHalf,
					EPubKey:    ePublicKey,
				})
				publicKeyLookup = append(publicKeyLookup, i)
			}
		}
		if len(keys) == 0 {
			err = makeRekeyReadError(ctx, km.config, md, keyGen, uid, username)
			return tlfCryptKey, err
		}
		var index int
		clientHalf, index, err = crypto.DecryptTLFCryptKeyClientHalfAny(ctx,
			keys, flags&getTLFCryptKeyPromptPaper != 0)
		if err != nil {
			// The likely error here is DecryptionError, which we will replace
			// with a ReadAccessError to communicate to the caller that we were
			// unable to decrypt because we didn't have a key with access.
			return tlfCryptKey, makeRekeyReadError(ctx, km.config, md, keyGen,
				uid, username)
		}
		info = keysInfo[index]
		cryptPublicKey = publicKeys[publicKeyLookup[index]]
	} else {
		cryptPublicKey, err = kbpki.GetCurrentCryptPublicKey(ctx)
		if err != nil {
			return tlfCryptKey, err
		}

		var ok bool
		info, ok, err = md.GetTLFCryptKeyInfo(keyGen, uid, cryptPublicKey)
		if err != nil {
			return tlfCryptKey, err
		}
		if !ok {
			err = makeRekeyReadError(ctx, km.config, md, keyGen, uid, username)
			return tlfCryptKey, err
		}

		ePublicKey, err := md.GetTLFEphemeralPublicKey(keyGen, uid,
			cryptPublicKey)
		if err != nil {
			return tlfCryptKey, err
		}

		clientHalf, err = crypto.DecryptTLFCryptKeyClientHalf(ctx, ePublicKey,
			info.ClientHalf)
		if err != nil {
			return tlfCryptKey, err
		}
	}

	// get the server-side key-half, do the unmasking, possibly cache the result, return
	// TODO: can parallelize the get() with decryption
	kops := km.config.KeyOps()
	serverHalf, err := kops.GetTLFCryptKeyServerHalf(ctx, info.ServerHalfID,
		cryptPublicKey)
	if err != nil {
		return tlfCryptKey, err
	}

	if tlfCryptKey, err =
		crypto.UnmaskTLFCryptKey(serverHalf, clientHalf); err != nil {
		return
	}

	if flags&getTLFCryptKeyDoCache != 0 {
		if err = kcache.PutTLFCryptKey(md.ID, keyGen, tlfCryptKey); err != nil {
			tlfCryptKey = TLFCryptKey{}
			return
		}
	}

	return
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
	md *RootMetadata, keyInfoMap UserDeviceKeyInfoMap,
	expectedKeys map[keybase1.UID][]CryptPublicKey) map[keybase1.UID]bool {
	users := make(map[keybase1.UID]bool)
	for u, keys := range expectedKeys {
		kids, ok := keyInfoMap[u]
		if !ok {
			// Currently there probably shouldn't be any new users
			// in the handle, but don't error just in case we ever
			// want to support that in the future.
			km.log.CInfof(ctx, "Rekey %s: adding new user %s", md.ID, u)
			users[u] = true
			continue
		}
		for _, k := range keys {
			km.log.CDebugf(ctx, "Checking key %v", k.kid)
			if _, ok := kids[k.kid]; !ok {
				km.log.CInfof(ctx, "Rekey %s: adding new device %s for user %s",
					md.ID, k.kid, u)
				users[u] = true
				break
			}
		}
	}
	return users
}

func (km *KeyManagerStandard) usersWithRemovedDevices(ctx context.Context,
	md *RootMetadata, keyInfoMap UserDeviceKeyInfoMap,
	expectedKeys map[keybase1.UID][]CryptPublicKey) map[keybase1.UID]bool {
	users := make(map[keybase1.UID]bool)
	for u, kids := range keyInfoMap {
		keys, ok := expectedKeys[u]
		if !ok {
			// Currently there probably shouldn't be any users removed
			// from the handle, but don't error just in case we ever
			// want to support that in the future.
			km.log.CInfof(ctx, "Rekey %s: removing user %s", md.ID, u)
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
					"Rekey %s: removing device %s for user %s", md.ID, kid, u)
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
	md *RootMetadata, writersToIdentify map[keybase1.UID]bool,
	readersToIdentify map[keybase1.UID]bool) error {
	// Fire off identifies to make sure the users are legit. TODO:
	// parallelize?
	handle := md.GetTlfHandle()
	for u := range writersToIdentify {
		err := identifyUID(ctx, km.config.KBPKI(),
			handle.GetCanonicalName(ctx, km.config), u, true,
			md.ID.IsPublic())
		if err != nil {
			return err
		}
	}
	for u := range readersToIdentify {
		err := identifyUID(ctx, km.config.KBPKI(),
			handle.GetCanonicalName(ctx, km.config), u, false,
			md.ID.IsPublic())
		if err != nil {
			return err
		}
	}
	return nil
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
func (km *KeyManagerStandard) doRekey(ctx context.Context, md *RootMetadata,
	promptPaper bool) (
	rekeyDone bool, cryptKey *TLFCryptKey, err error) {
	km.log.CDebugf(ctx, "Rekey %s (prompt for paper key: %t)",
		md.ID, promptPaper)
	defer func() { km.log.CDebugf(ctx, "Rekey %s done: %#v", md.ID, err) }()

	currKeyGen := md.LatestKeyGeneration()
	if md.ID.IsPublic() || currKeyGen == PublicKeyGen {
		return false, nil, InvalidPublicTLFOperation{md.ID, "rekey"}
	}

	handle := md.GetTlfHandle()

	username, uid, err := km.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return false, nil, err
	}

	// Decide whether we have a new device and/or a revoked device, or neither.
	// Look up all the device public keys for all writers and readers first.

	incKeyGen := currKeyGen < FirstValidKeyGen

	if !handle.IsWriter(uid) && incKeyGen {
		// Readers cannot create the first key generation
		return false, nil, NewReadAccessError(ctx, km.config, handle, username)
	}

	wKeys, err := km.generateKeyMapForUsers(ctx, handle.Writers)
	if err != nil {
		return false, nil, err
	}
	rKeys, err := km.generateKeyMapForUsers(ctx, handle.Readers)
	if err != nil {
		return false, nil, err
	}

	addNewReaderDevice := false
	addNewWriterDevice := false
	var newReaderUsers map[keybase1.UID]bool
	var newWriterUsers map[keybase1.UID]bool

	if !incKeyGen {
		// See if there is at least one new device in relation to the
		// current key bundle
		wkb, rkb, err := md.getTLFKeyBundles(currKeyGen)
		if err != nil {
			return false, nil, err
		}

		newWriterUsers = km.usersWithNewDevices(ctx, md, wkb.WKeys, wKeys)
		newReaderUsers = km.usersWithNewDevices(ctx, md, rkb.RKeys, rKeys)
		addNewWriterDevice = len(newWriterUsers) > 0
		addNewReaderDevice = len(newReaderUsers) > 0

		wRemoved := km.usersWithRemovedDevices(ctx, md, wkb.WKeys, wKeys)
		rRemoved := km.usersWithRemovedDevices(ctx, md, rkb.RKeys, rKeys)
		incKeyGen = len(wRemoved) > 0 || len(rRemoved) > 0

		for u := range wRemoved {
			newWriterUsers[u] = true
		}
		for u := range rRemoved {
			newReaderUsers[u] = true
		}

		if err := km.identifyUIDSets(ctx, md, newWriterUsers, newReaderUsers); err != nil {
			return false, nil, err
		}
	}

	if !addNewReaderDevice && !addNewWriterDevice && !incKeyGen {
		km.log.CDebugf(ctx, "Skipping rekeying %s: no new or removed devices",
			md.ID)
		return false, nil, nil
	}

	if !handle.IsWriter(uid) {
		if _, userHasNewKeys := newReaderUsers[uid]; userHasNewKeys {
			// Only rekey the logged-in reader
			rKeys = map[keybase1.UID][]CryptPublicKey{
				uid: rKeys[uid],
			}
			wKeys = nil
			delete(newReaderUsers, uid)
		} else {
			// No new reader device for our user, so the reader can't do
			// anything
			return false, nil, NewReadAccessError(ctx, km.config, handle, username)
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
			currTlfCryptKey, err := km.getTLFCryptKey(ctx, md, keyGen, flags)
			if err != nil {
				return false, nil, err
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
		if err := decryptMDPrivateData(ctx, km.config, md); err != nil {
			return false, nil, err
		}
	}

	if !handle.IsWriter(uid) {
		if len(newReaderUsers) > 0 || addNewWriterDevice || incKeyGen {
			// If we're a reader but we haven't completed all the work, return
			// RekeyIncompleteError
			return false, nil, RekeyIncompleteError{}
		}
		// Otherwise, there's nothing left to do!
		return true, nil, nil
	} else if !incKeyGen {
		// we're done!
		return true, nil, nil
	}

	// Send rekey start notification once we're sure that this device
	// can perform the rekey.
	km.config.Reporter().Notify(ctx, rekeyNotification(ctx, km.config, handle,
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

// Rekey implements the KeyManager interface for KeyManagerStandard.
func (km *KeyManagerStandard) Rekey(ctx context.Context, md *RootMetadata) (
	rekeyDone bool, cryptKey *TLFCryptKey, err error) {
	return km.doRekey(ctx, md, false)
}

// RekeyWithPrompt implements the KeyManager interface for
// KeyManagerStandard.
func (km *KeyManagerStandard) RekeyWithPrompt(ctx context.Context,
	md *RootMetadata) (rekeyDone bool, cryptKey *TLFCryptKey, err error) {
	return km.doRekey(ctx, md, true)
}
