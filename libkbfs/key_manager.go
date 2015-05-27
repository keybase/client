package libkbfs

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type KeyManagerStandard struct {
	config Config
}

func (km *KeyManagerStandard) GetTLFCryptKey(dir Path, md *RootMetadata) (
	tlfCryptKey TLFCryptKey, err error) {
	if md.Id.IsPublic() {
		// no key is needed, return an empty key
		// TODO: This should be handled at a higher level,
		// i.e. all the encryption/decryption code should be
		// bypassed for public directories.
		return
	}

	// Figure out what version of the key we need.  The md will always
	// need the latest key to encrypt, but old blocks may require
	// older keys.
	keyVer := md.LatestKeyVersion()
	if len(dir.Path) > 0 {
		keyVer = dir.TailPointer().GetKeyVer()
	}
	// Is this some key we don't know yet?  Shouldn't really ever happen,
	// since we must have seen the MD that led us to this block, which
	// should include all the latest keys.  Consider this a failsafe.
	if keyVer > md.LatestKeyVersion() {
		err = &NewKeyVersionError{md.GetDirHandle().ToString(km.config), keyVer}
		return
	}

	// look in the cache first
	kcache := km.config.KeyCache()
	if tlfCryptKey, err = kcache.GetTLFCryptKey(md.Id, keyVer); err == nil {
		return
	}

	// Get the encrypted version of this secret key for this device
	kbpki := km.config.KBPKI()
	user, err := kbpki.GetLoggedInUser()
	if err != nil {
		return
	}

	currentCryptPublicKey, err := kbpki.GetCurrentCryptPublicKey()
	if err != nil {
		return
	}

	clientHalfData, ok := md.GetEncryptedTLFCryptKeyClientHalfData(keyVer, user, currentCryptPublicKey)
	if !ok {
		err = NewReadAccessError(km.config, md.GetDirHandle(), user)
		return
	}

	crypto := km.config.Crypto()

	clientHalf, err :=
		crypto.DecryptTLFCryptKeyClientHalf(md.GetTLFEphemeralPublicKey(keyVer), clientHalfData)
	if err != nil {
		return
	}

	// now get the server-side key-half, do the unmasking, cache the result, return
	// TODO: can parallelize the get() with decryption
	kops := km.config.KeyOps()
	serverHalf, err := kops.GetTLFCryptKeyServerHalf(md.Id, keyVer, currentCryptPublicKey)
	if err != nil {
		return
	}

	if tlfCryptKey, err = crypto.UnmaskTLFCryptKey(serverHalf, clientHalf); err != nil {
		return
	}

	if err = kcache.PutTLFCryptKey(md.Id, keyVer, tlfCryptKey); err != nil {
		tlfCryptKey = TLFCryptKey{}
		return
	}

	return
}

func (km *KeyManagerStandard) GetBlockCryptKey(
	dir Path, id BlockId, md *RootMetadata) (blockCryptKey BlockCryptKey, err error) {
	if md.Id.IsPublic() {
		// no key is needed, return an empty key
		// TODO: This should be handled at a higher level,
		// i.e. all the encryption/decryption code should be
		// bypassed for blocks in public directories.
		return
	}

	// look in the cache first
	kcache := km.config.KeyCache()
	if blockCryptKey, err = kcache.GetBlockCryptKey(id); err == nil {
		return
	}

	// otherwise, get the secret key, then the server side block key
	dirKey, err := km.GetTLFCryptKey(dir, md)
	if err != nil {
		return
	}

	serverHalf, err := km.config.KeyOps().GetBlockCryptKeyServerHalf(id)
	if err != nil {
		return
	}

	blockCryptKey, err = km.config.Crypto().UnmaskBlockCryptKey(serverHalf, dirKey)
	if err != nil {
		return
	}

	err = kcache.PutBlockCryptKey(id, blockCryptKey)
	if err != nil {
		blockCryptKey = BlockCryptKey{}
		return
	}

	return
}

func (km *KeyManagerStandard) secretKeysForUser(md *RootMetadata, uid keybase1.UID,
	tlfCryptKey TLFCryptKey, ePrivKey TLFEphemeralPrivateKey) (uMap map[libkb.KIDMapKey][]byte, err error) {
	defer func() {
		if err != nil {
			uMap = nil
		}
	}()

	uMap = make(map[libkb.KIDMapKey][]byte)

	if md.Id.IsPublic() {
		// no per-device keys for public directories
		// TODO: Handle this at a higher level.
		return
	}

	kbpki := km.config.KBPKI()
	crypto := km.config.Crypto()
	kops := km.config.KeyOps()
	keyVer := md.LatestKeyVersion() + 1

	publicKeys, err := kbpki.GetCryptPublicKeys(uid)
	if err != nil {
		return
	}

	// for each device:
	//    * create a new random server half
	//    * mask it with the key to get the client half
	//    * encrypt the client half
	//    * push the server half to the server
	//
	// TODO: parallelize
	for _, k := range publicKeys {
		var serverHalf TLFCryptKeyServerHalf
		serverHalf, err = crypto.MakeRandomTLFCryptKeyServerHalf()
		if err != nil {
			return
		}

		var clientHalf TLFCryptKeyClientHalf
		clientHalf, err = crypto.MaskTLFCryptKey(serverHalf, tlfCryptKey)
		if err != nil {
			return
		}

		var encryptedClientHalf []byte
		encryptedClientHalf, err = crypto.EncryptTLFCryptKeyClientHalf(ePrivKey, k, clientHalf)
		if err != nil {
			return
		}

		if err = kops.PutTLFCryptKeyServerHalf(
			md.Id, keyVer, uid, k, serverHalf); err != nil {
			return
		}

		uMap[k.KID.ToMapKey()] = encryptedClientHalf
	}

	return
}

func (km *KeyManagerStandard) Rekey(md *RootMetadata) error {
	if md.Id.IsPublic() && md.IsInitialized() {
		// no rekey is needed for public directories
		// TODO: Handle this at a higher level.
		return nil
	}

	crypto := km.config.Crypto()
	pubKey, privKey, ePubKey, ePrivKey, tlfCryptKey, err := crypto.MakeRandomTLFKeys()
	if err != nil {
		return err
	}

	handle := md.GetDirHandle()
	newKeys := DirKeyBundle{
		WKeys:                 make(map[keybase1.UID]map[libkb.KIDMapKey][]byte),
		RKeys:                 make(map[keybase1.UID]map[libkb.KIDMapKey][]byte),
		TLFPublicKey:          pubKey,
		TLFEphemeralPublicKey: ePubKey,
	}
	// TODO: parallelize
	for _, w := range handle.Writers {
		if uMap, err := km.secretKeysForUser(
			md, w, tlfCryptKey, ePrivKey); err != nil {
			return err
		} else {
			newKeys.WKeys[w] = uMap
		}
	}
	for _, r := range handle.Readers {
		if uMap, err := km.secretKeysForUser(
			md, r, tlfCryptKey, ePrivKey); err != nil {
			return err
		} else {
			newKeys.RKeys[r] = uMap
		}
	}
	md.AddNewKeys(newKeys)

	// Discard ePrivKey.

	md.data.TLFPrivateKey = privKey

	// Might as well cache the TLFCryptKey while we're at it.
	return km.config.KeyCache().PutTLFCryptKey(md.Id, md.LatestKeyVersion(), tlfCryptKey)
}
