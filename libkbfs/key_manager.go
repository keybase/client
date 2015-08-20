package libkbfs

import (
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// KeyManagerStandard implements the KeyManager interface by fetching
// keys from KeyOps and KBPKI, and computing the complete keys
// necessary to run KBFS.
type KeyManagerStandard struct {
	config Config
}

// GetTLFCryptKeyForEncryption implements the KeyManager interface for
// KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForEncryption(ctx context.Context,
	md *RootMetadata) (tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKey(ctx, md, md.LatestKeyGeneration())
}

// GetTLFCryptKeyForMDDecryption implements the KeyManager interface
// for KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForMDDecryption(
	ctx context.Context, md *RootMetadata) (
	tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKey(ctx, md, md.LatestKeyGeneration())
}

// GetTLFCryptKeyForBlockDecryption implements the KeyManager interface for
// KeyManagerStandard.
func (km *KeyManagerStandard) GetTLFCryptKeyForBlockDecryption(
	ctx context.Context, md *RootMetadata, blockPtr BlockPointer) (
	tlfCryptKey TLFCryptKey, err error) {
	return km.getTLFCryptKey(ctx, md, blockPtr.KeyGen)
}

func (km *KeyManagerStandard) getTLFCryptKey(ctx context.Context,
	md *RootMetadata, keyGen KeyGen) (tlfCryptKey TLFCryptKey, err error) {
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
	user, err := kbpki.GetLoggedInUser(ctx)
	if err != nil {
		return
	}

	currentCryptPublicKey, err := kbpki.GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return
	}

	info, ok, err := md.GetTLFCryptKeyInfo(keyGen, user, currentCryptPublicKey)
	if err != nil {
		return
	}
	if !ok {
		err = NewReadAccessError(ctx, km.config, md.GetTlfHandle(), user)
		return
	}

	ePublicKey, err := md.GetTLFEphemeralPublicKey(keyGen)
	if err != nil {
		return
	}

	crypto := km.config.Crypto()
	clientHalf, err :=
		crypto.DecryptTLFCryptKeyClientHalf(ctx, ePublicKey, info.ClientHalf)
	if err != nil {
		return
	}

	// now get the server-side key-half, do the unmasking, cache the result, return
	// TODO: can parallelize the get() with decryption
	kops := km.config.KeyOps()
	serverHalf, err := kops.GetTLFCryptKeyServerHalf(ctx, info.ServerHalfID)
	if err != nil {
		return
	}

	if tlfCryptKey, err = crypto.UnmaskTLFCryptKey(serverHalf, clientHalf); err != nil {
		return
	}

	if err = kcache.PutTLFCryptKey(md.ID, keyGen, tlfCryptKey); err != nil {
		tlfCryptKey = TLFCryptKey{}
		return
	}

	return
}

func (km *KeyManagerStandard) secretKeysForUser(ctx context.Context,
	md *RootMetadata, uid keybase1.UID, tlfCryptKey TLFCryptKey,
	ePrivKey TLFEphemeralPrivateKey) (
	clientMap map[keybase1.KID]TLFCryptKeyInfo,
	serverMap map[keybase1.KID]TLFCryptKeyServerHalf, err error) {
	defer func() {
		if err != nil {
			clientMap = nil
			serverMap = nil
		}
	}()

	clientMap = make(map[keybase1.KID]TLFCryptKeyInfo)
	serverMap = make(map[keybase1.KID]TLFCryptKeyServerHalf)

	if md.ID.IsPublic() {
		// no per-device keys for public directories
		// TODO: Handle this at a higher level.
		return
	}

	crypto := km.config.Crypto()

	publicKeys, err := km.config.KBPKI().GetCryptPublicKeys(ctx, uid)
	if err != nil {
		return
	}

	// for each device:
	//    * create a new random server half
	//    * mask it with the key to get the client half
	//    * encrypt the client half
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

		var encryptedClientHalf EncryptedTLFCryptKeyClientHalf
		encryptedClientHalf, err = crypto.EncryptTLFCryptKeyClientHalf(ePrivKey, k, clientHalf)
		if err != nil {
			return
		}

		var serverHalfID TLFCryptKeyServerHalfID
		serverHalfID, err = crypto.GetTLFCryptKeyServerHalfID(uid, k.KID, serverHalf)
		if err != nil {
			return
		}

		keyInfo := TLFCryptKeyInfo{
			ClientHalf:   encryptedClientHalf,
			ServerHalfID: serverHalfID,
		}
		clientMap[k.KID] = keyInfo
		serverMap[k.KID] = serverHalf
	}

	return
}

// Rekey implements the KeyManager interface for KeyManagerStandard.
func (km *KeyManagerStandard) Rekey(ctx context.Context,
	md *RootMetadata) error {
	if md.ID.IsPublic() {
		return InvalidPublicTLFOperation{md.ID, "rekey"}
	}

	crypto := km.config.Crypto()
	pubKey, privKey, ePubKey, ePrivKey, tlfCryptKey, err := crypto.MakeRandomTLFKeys()
	if err != nil {
		return err
	}

	handle := md.GetTlfHandle()
	newClientKeys := DirKeyBundle{
		WKeys:                 make(map[keybase1.UID]map[keybase1.KID]TLFCryptKeyInfo),
		RKeys:                 make(map[keybase1.UID]map[keybase1.KID]TLFCryptKeyInfo),
		TLFPublicKey:          pubKey,
		TLFEphemeralPublicKey: ePubKey,
	}
	newServerKeys := make(map[keybase1.UID]map[keybase1.KID]TLFCryptKeyServerHalf)

	// TODO: parallelize
	for _, w := range handle.Writers {
		clientMap, serverMap, err := km.secretKeysForUser(ctx, md, w, tlfCryptKey, ePrivKey)
		if err != nil {
			return err
		}
		newClientKeys.WKeys[w] = clientMap
		newServerKeys[w] = serverMap
	}
	for _, r := range handle.Readers {
		clientMap, serverMap, err := km.secretKeysForUser(ctx, md, r, tlfCryptKey, ePrivKey)
		if err != nil {
			return err
		}
		newClientKeys.RKeys[r] = clientMap
		newServerKeys[r] = serverMap
	}

	// Push new keys to the key server.
	if err = km.config.KeyOps().PutTLFCryptKeyServerHalves(ctx, newServerKeys); err != nil {
		return err
	}

	err = md.AddNewKeys(newClientKeys)
	if err != nil {
		return err
	}

	// Discard ePrivKey.

	md.data.TLFPrivateKey = privKey

	// Might as well cache the TLFCryptKey while we're at it.
	return km.config.KeyCache().PutTLFCryptKey(md.ID, md.LatestKeyGeneration(), tlfCryptKey)
}
