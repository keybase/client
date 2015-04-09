package libkbfs

import (
	libkb "github.com/keybase/client/go/libkb"
)

type KeyManagerStandard struct {
	config Config
}

func (km *KeyManagerStandard) GetSecretKey(dir Path, md *RootMetadata) (
	k Key, err error) {
	if md.Id.IsPublic() {
		// no key is needed, return the null key
		return NullKey, nil
	}

	// Figure out what version of the key we need.  The md will always
	// need the latest key to encrypt, but old blocks may require
	// older keys.
	keyId := md.LatestKeyId()
	if len(dir.Path) > 0 {
		keyId = dir.TailPointer().GetKeyId()
	}
	// Is this some key we don't know yet?  Shouldn't really ever happen,
	// since we must have seen the MD that led us to this block, which
	// should include all the latest keys.  Consider this a failsafe.
	if keyId > md.LatestKeyId() {
		return NullKey,
			&NewKeyError{md.GetDirHandle().ToString(km.config), keyId}
	}

	// look in the cache first
	kcache := km.config.KeyCache()
	if k, err = kcache.GetDirKey(md.Id, keyId); err == nil {
		return
	}

	// Get the encrypted version of this secret key for this device
	kbpki := km.config.KBPKI()
	crypto := km.config.Crypto()
	user, err := kbpki.GetLoggedInUser()
	if err != nil {
		return NullKey, err
	}
	dev, err := kbpki.GetActiveDeviceId()
	if err != nil {
		return NullKey, err
	}
	var xKey Key // the xor'd secret key
	if buf, ok := md.GetEncryptedSecretKey(keyId, user, dev); !ok {
		err = readAccessError(km.config, md, user)
		return
	} else if xBuf, err2 :=
		crypto.Unbox(md.GetPubKey(keyId), buf); err2 != nil {
		err = err2
		return
	} else if err = km.config.Codec().Decode(xBuf, &xKey); err != nil {
		return
	}

	// now get the server-side key-half, do the xor, cache the result, return
	// TODO: can parallelize the get() with decryption
	kops := km.config.KeyOps()
	if devKey, err2 := kops.GetDirDeviceKey(md.Id, keyId, dev); err2 != nil {
		err = err2
		return
	} else if k, err = crypto.XOR(xKey, devKey); err == nil {
		err = kcache.PutDirKey(md.Id, keyId, k)
	}

	return
}

func (km *KeyManagerStandard) GetSecretBlockKey(
	dir Path, id BlockId, md *RootMetadata) (k Key, err error) {
	if md.Id.IsPublic() {
		// no key is needed, return the null key
		return NullKey, nil
	}

	// look in the cache first
	kcache := km.config.KeyCache()
	if k, err = kcache.GetBlockKey(id); err == nil {
		return
	}

	// otherwise, get the secret key, then the server side block key
	dirKey, err := km.GetSecretKey(dir, md)
	if err != nil {
		return NullKey, err
	}

	if k, err = km.config.KeyOps().GetBlockKey(id); err != nil {
		return
	} else if k, err = km.config.Crypto().XOR(dirKey, k); err != nil {
		return
	} else {
		return k, kcache.PutBlockKey(id, k)
	}
}

func (km *KeyManagerStandard) secretKeysForUser(md *RootMetadata, uid libkb.UID,
	secret Key, privKey Key) (uMap map[DeviceId][]byte, err error) {
	uMap = make(map[DeviceId][]byte)
	if md.Id.IsPublic() {
		// no per-device keys for public directories
		return uMap, nil
	}

	kbpki := km.config.KBPKI()
	crypto := km.config.Crypto()
	codec := km.config.Codec()
	kops := km.config.KeyOps()
	keyId := md.LatestKeyId() + 1

	// for each device:
	//    * create a new random secret key
	//    * XOR the two secret keys together
	//    * box up the encoded, xor'd key
	//    * push the user-device secret key to the server
	user, err := kbpki.GetUser(uid)
	if err != nil {
		return uMap, err
	}
	deviceMap, err := kbpki.GetDeviceSubKeys(user)
	if err != nil {
		return uMap, err
	}
	// TODO: parallelize
	for d, k := range deviceMap {
		serverSecret := crypto.GenRandomSecretKey()
		xSecret, err := crypto.XOR(secret, serverSecret)
		if err != nil {
			return uMap, err
		}
		xBuf, err := codec.Encode(xSecret)
		if err != nil {
			return uMap, err
		}
		boxedSecret, err := crypto.Box(privKey, k, xBuf)
		if err != nil {
			return uMap, err
		}
		if err = kops.PutDirDeviceKey(
			md.Id, keyId, uid, d, serverSecret); err != nil {
			return uMap, err
		} else {
			uMap[d] = boxedSecret
		}
	}
	return
}

func (km *KeyManagerStandard) Rekey(md *RootMetadata) error {
	if md.Id.IsPublic() && md.IsInitialized() {
		// no rekey is needed for public directories
		return nil
	}

	crypto := km.config.Crypto()
	// create a new random secret key
	secret := crypto.GenRandomSecretKey()
	// create a new random pub/priv key pair
	pubKey, privKey := crypto.GenCurveKeyPair()

	handle := md.GetDirHandle()
	newKeys := DirKeys{
		WKeys: make(map[libkb.UID]map[DeviceId][]byte),
		RKeys: make(map[libkb.UID]map[DeviceId][]byte),
	}
	// TODO: parallelize
	for _, w := range handle.Writers {
		if uMap, err := km.secretKeysForUser(
			md, w, secret, privKey); err != nil {
			return err
		} else {
			newKeys.WKeys[w] = uMap
		}
	}
	for _, r := range handle.Readers {
		if uMap, err := km.secretKeysForUser(
			md, r, secret, privKey); err != nil {
			return err
		} else {
			newKeys.RKeys[r] = uMap
		}
	}

	newKeys.PubKey = pubKey
	md.AddNewKeys(newKeys)
	md.data.PrivKey = privKey

	// might as well cache the secret while we're at it
	return km.config.KeyCache().PutDirKey(md.Id, md.LatestKeyId(), secret)
}
