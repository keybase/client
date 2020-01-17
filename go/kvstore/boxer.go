package kvstore

import (
	"encoding/base64"
	"fmt"

	"github.com/keybase/client/go/chat/signencrypt"
	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teambot"
	"github.com/keybase/go-crypto/ed25519"
)

type KVStoreBoxer interface {
	Box(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, cleartextValue string, botName string) (ciphertext string,
		teamKeyGen keybase1.PerTeamKeyGeneration, ciphertextVersion int, botUID keybase1.UID, botEldestSeqno keybase1.Seqno, err error)
	Unbox(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, ciphertext string, teamKeyGen keybase1.PerTeamKeyGeneration, formatVersion int,
		senderUID keybase1.UID, senderEldestSeqno keybase1.Seqno, senderDeviceID keybase1.DeviceID, botUID keybase1.UID, botEldestSeqno keybase1.Seqno) (cleartext string, err error)
}

var _ KVStoreBoxer = (*KVStoreRealBoxer)(nil)

type KVStoreRealBoxer struct {
	libkb.Contextified
}

func NewKVStoreBoxer(g *libkb.GlobalContext) *KVStoreRealBoxer {
	return &KVStoreRealBoxer{
		Contextified: libkb.NewContextified(g),
	}
}

type kvStoreMetadata struct {
	EntryID           keybase1.KVEntryID `codec:"e" json:"e"`
	Revision          int                `codec:"r" json:"r"`
	EncKey            keybase1.Bytes32   `codec:"k" json:"k"`
	CiphertextVersion int                `codec:"v" json:"v"`
	UID               keybase1.UID       `codec:"u" json:"u"`
	EldestSeqno       keybase1.Seqno     `codec:"s" json:"s"`
	DeviceID          keybase1.DeviceID  `codec:"d" json:"d"`
	BotUID            keybase1.UID       `codec:"bu" json:"bu"`
	BotEldestSeqno    keybase1.Seqno     `codec:"bs" json:"bs"`
}

func newNonce() (ret [signencrypt.NonceSize]byte, err error) {
	randBytes, err := libkb.RandBytes(signencrypt.NonceSize)
	if err != nil {
		return ret, err
	}
	copy(ret[:], randBytes)
	return ret, nil
}

func (b *KVStoreRealBoxer) loadAppKey(mctx libkb.MetaContext, teamID keybase1.TeamID, generation *keybase1.PerTeamKeyGeneration) (appKey keybase1.TeamApplicationKey, err error) {
	loadArg := keybase1.FastTeamLoadArg{
		ID:           teamID,
		Applications: []keybase1.TeamApplication{keybase1.TeamApplication_KVSTORE},
	}
	if generation == nil {
		loadArg.NeedLatestKey = true
	} else {
		loadArg.KeyGenerationsNeeded = []keybase1.PerTeamKeyGeneration{*generation}
	}

	res, err := mctx.G().GetFastTeamLoader().Load(mctx, loadArg)
	if err != nil {
		return appKey, err
	}
	if len(res.ApplicationKeys) != 1 {
		return appKey, fmt.Errorf("wrong number of keys from fast-team-loading encryption key; wanted 1, got %d", len(res.ApplicationKeys))
	}
	appKey = res.ApplicationKeys[0]
	if generation != nil && appKey.KeyGeneration != *generation {
		return appKey, fmt.Errorf("wrong app key generation; wanted %d but got %d", *generation, appKey.KeyGeneration)
	}
	if appKey.Application != keybase1.TeamApplication_KVSTORE {
		return appKey, fmt.Errorf("wrong app key application; wanted %d but got %d", keybase1.TeamApplication_KVSTORE, appKey.Application)
	}
	return appKey, nil
}

func (b *KVStoreRealBoxer) fetchEncryptionKey(mctx libkb.MetaContext, entryID keybase1.KVEntryID, generation *keybase1.PerTeamKeyGeneration) (res [signencrypt.SecretboxKeySize]byte, gen keybase1.PerTeamKeyGeneration, err error) {
	// boxing can always use the latest key, unboxing will pass in a team generation to load
	appKey, err := b.loadAppKey(mctx, entryID.TeamID, generation)
	if err != nil {
		return res, gen, err
	}
	var encKey [signencrypt.SecretboxKeySize]byte = appKey.Key
	return encKey, appKey.KeyGeneration, nil
}

func (b *KVStoreRealBoxer) fetchRestrictedBotEncryptionKey(mctx libkb.MetaContext, entryID keybase1.KVEntryID, botUID keybase1.UID, generation *keybase1.PerTeamKeyGeneration) (res [signencrypt.SecretboxKeySize]byte, gen keybase1.TeambotKeyGeneration, err error) {
	// boxing can always use the latest key, unboxing will pass in a team generation to load
	botUIDBytes := gregor1.UID(botUID.ToBytes())
	if teambot.CurrentUserIsBot(mctx, &botUIDBytes) {
		keyer := mctx.G().GetTeambotBotKeyer()
		var key keybase1.TeambotKey
		if generation == nil {
			key, err = keyer.GetLatestTeambotKey(mctx, entryID.TeamID, keybase1.TeamApplication_KVSTORE)
			if err != nil {
				return res, gen, err
			}
		} else {
			key, err = keyer.GetTeambotKeyAtGeneration(mctx, entryID.TeamID, keybase1.TeamApplication_KVSTORE, keybase1.TeambotKeyGeneration(*generation))
			if err != nil {
				return res, gen, err
			}
		}
		var encKey [signencrypt.SecretboxKeySize]byte = key.Seed
		return encKey, key.Metadata.Generation, nil
	} else {
		// boxing can always use the latest key, unboxing will pass in a team generation to load
		appKey, err := b.loadAppKey(mctx, entryID.TeamID, generation)
		if err != nil {
			return res, gen, err
		}

		// convert this key in to a TeambotKey
		key, _, err := mctx.G().GetTeambotMemberKeyer().GetOrCreateTeambotKey(
			mctx, entryID.TeamID, botUIDBytes, appKey)
		var encKey [signencrypt.SecretboxKeySize]byte = key.Seed
		return encKey, key.Metadata.Generation, nil
	}
}

func (b *KVStoreRealBoxer) fetchVerifyKey(mctx libkb.MetaContext, uid keybase1.UID, deviceID keybase1.DeviceID) (ret signencrypt.VerifyKey, err error) {
	upk, err := b.G().GetUPAKLoader().LoadUPAKWithDeviceID(mctx.Ctx(), uid, deviceID)
	if err != nil {
		return nil, err
	}
	verifyKID, _ := upk.Current.FindSigningDeviceKID(deviceID)
	verifyKey := kbcrypto.KIDToNaclSigningKeyPublic(verifyKID.ToBytes())
	if verifyKey == nil {
		return nil, kbcrypto.BadKeyError{}
	}
	var verKey [ed25519.PublicKeySize]byte = *verifyKey
	return &verKey, nil
}

/*
// Bot encrypts for team key
func (b *KVStoreRealBoxer) Box(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, cleartext string) (
	ciphertext string, teamKeyGen keybase1.PerTeamKeyGeneration, version int, err error) {

	defer mctx.TraceTimed(fmt.Sprintf("KVStoreRealBoxer#Box: %s, %s, %s", entryID.TeamID, entryID.Namespace, entryID.EntryKey),
		func() error { return err })()

	clearBytes := []byte(cleartext)
	ciphertextVersion := 1
	nonce, err := newNonce()
	if err != nil {
		mctx.Debug("error making a nonce: %v", err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, err
	}
	// get encryption key (and team generation) and this device's signing key
	encKey, teamGen, err := b.fetchEncryptionKey(mctx, entryID, nil)
	if err != nil {
		mctx.Debug("error fetching encryption key for entry %+v: %v", entryID, err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, err
	}
	uv, deviceID, _, signingKey, _ := mctx.G().ActiveDevice.AllFields()
	signingKP, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || signingKP.Private == nil {
		mctx.Debug("error with signing key: %v", err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, libkb.KeyCannotSignError{}
	}
	var signKey [ed25519.PrivateKeySize]byte = *signingKP.Private
	// build associated data
	seqno := keybase1.Seqno(0) // "nil"
	associatedData := kvStoreMetadata{
		EntryID:           entryID,
		Revision:          revision,
		EncKey:            encKey,
		CiphertextVersion: ciphertextVersion,
		UID:               uv.Uid,
		EldestSeqno:       uv.EldestSeqno,
		DeviceID:          deviceID,
		BotUID:            nil,
		BotEldestSeqno:    &seqno,
	}

	// seal it all up
	signEncryptedBytes, err := signencrypt.SealWithAssociatedData(
		clearBytes, associatedData, &encKey, &signKey, kbcrypto.SignaturePrefixTeamStore, &nonce)
	if err != nil {
		mctx.Debug("error sealing message and associated data: %v", err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, err
	}
	boxed := keybase1.EncryptedKVEntry{
		V: 1,
		E: signEncryptedBytes,
		N: nonce[:],
	}
	// pack it, string it, ship it.
	packed, err := msgpack.Encode(boxed)
	if err != nil {
		mctx.Debug("error msgpacking secretbox for entry %+v: %v", entryID, err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, err
	}
	return base64.StdEncoding.EncodeToString(packed), teamGen, ciphertextVersion, nil
}
*/

// Box encrypts for the team key if botName is null; else it encrypts restricted bot key
func (b *KVStoreRealBoxer) Box(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, cleartext string, botName string) (
	ciphertext string, teamKeyGen keybase1.PerTeamKeyGeneration, version int, botUID keybase1.UID, botEldestSeqno keybase1.Seqno, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("KVStoreRealBoxer#Box: %s, %s, %s, %s", entryID.TeamID, entryID.Namespace, entryID.EntryKey, botName),
		func() error { return err })()

	if botName != "" {
		arg := libkb.NewLoadUserArgWithMetaContext(mctx).WithName(botName)
		upak, _, err := b.G().GetUPAKLoader().LoadV2(arg)
		if err != nil {
			return "", keybase1.PerTeamKeyGeneration(0), 0, "", 0, err
		}
		botUID = upak.Current.Uid
		botEldestSeqno = upak.Current.EldestSeqno
	}

	fmt.Printf("botUID = %+v, botName = %+v \n", botUID, botName)
	clearBytes := []byte(cleartext)
	ciphertextVersion := 1
	nonce, err := newNonce()
	if err != nil {
		mctx.Debug("error making a nonce: %v", err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, botUID, botEldestSeqno, err
	}

	// get encryption key (and team generation) and this device's signing key
	var encKey [signencrypt.SecretboxKeySize]byte
	if botName != "" {
		// get restricted bot key
		var botTeamGen keybase1.TeambotKeyGeneration
		encKey, botTeamGen, err = b.fetchRestrictedBotEncryptionKey(mctx, entryID, botUID, nil)
		if err != nil {
			mctx.Debug("error fetching restricted bot encryption key for entry %+v: %v", entryID, err)
			return "", keybase1.PerTeamKeyGeneration(0), 0, botUID, botEldestSeqno, err ///////
		}
		teamKeyGen = keybase1.PerTeamKeyGeneration(botTeamGen)
		fmt.Printf(">>>>>>>>. fetched boteamgen= %+v\n", botTeamGen)
		////// botEldestSeqno???
	} else {
		// get team key
		encKey, teamKeyGen, err = b.fetchEncryptionKey(mctx, entryID, nil)
		fmt.Printf(">>>>>>>>. fetched teamKeyGen = %+v\n", teamKeyGen)
		if err != nil {
			mctx.Debug("error fetching encryption key for entry %+v: %v", entryID, err)
			return "", keybase1.PerTeamKeyGeneration(0), 0, botUID, botEldestSeqno, err
		}
		//botEldestSeqno = keybase1.Seqno(0) // "nil"///////////
	}
	uv, deviceID, _, signingKey, _ := mctx.G().ActiveDevice.AllFields()
	signingKP, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || signingKP.Private == nil {
		mctx.Debug("error with signing key: %v", err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, botUID, botEldestSeqno, libkb.KeyCannotSignError{}
	}
	var signKey [ed25519.PrivateKeySize]byte = *signingKP.Private

	/*
		botUIDData := &botUID
		if botName == "" {
			fmt.Printf("%T, %+v, %v \n", botUID, botUID, botUID == "")
			botUIDData = nil
		}*/
	// build associated data
	associatedData := kvStoreMetadata{
		EntryID:           entryID,
		Revision:          revision,
		EncKey:            encKey,
		CiphertextVersion: ciphertextVersion,
		UID:               uv.Uid,
		EldestSeqno:       uv.EldestSeqno,
		DeviceID:          deviceID,
		BotUID:            botUID,
		BotEldestSeqno:    botEldestSeqno,
	}
	fmt.Printf(".....box AD = %+v\n", associatedData)

	// seal it all up
	signEncryptedBytes, err := signencrypt.SealWithAssociatedData(
		clearBytes, associatedData, &encKey, &signKey, kbcrypto.SignaturePrefixTeamStore, &nonce)
	if err != nil {
		mctx.Debug("error sealing message and associated data: %v", err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, botUID, botEldestSeqno, err
	}
	boxed := keybase1.EncryptedKVEntry{
		V: 1,
		E: signEncryptedBytes,
		N: nonce[:],
	}
	// pack it, string it, ship it.
	packed, err := msgpack.Encode(boxed)
	if err != nil {
		mctx.Debug("error msgpacking secretbox for entry %+v: %v", entryID, err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, botUID, botEldestSeqno, err
	}
	return base64.StdEncoding.EncodeToString(packed), teamKeyGen, ciphertextVersion, botUID, botEldestSeqno, nil /////////////
}

func (b *KVStoreRealBoxer) Unbox(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, ciphertext string,
	teamKeyGen keybase1.PerTeamKeyGeneration, formatVersion int, senderUID keybase1.UID, senderEldestSeqno keybase1.Seqno,
	senderDeviceID keybase1.DeviceID, botUID keybase1.UID, botEldestSeqno keybase1.Seqno) (cleartext string, err error) {

	defer mctx.TraceTimed(fmt.Sprintf("KVStoreRealBoxer#Unbox: t:%s, n:%s, k:%s", entryID.TeamID, entryID.Namespace, entryID.EntryKey),
		func() error { return err })()

	if formatVersion != 1 {
		return "", fmt.Errorf("unsupported format version %d isn't 1", formatVersion)
	}
	// basic decoding into a not-yet-unsealed box
	decoded, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		mctx.Debug("boxed message isn't base64: %v", err)
		return "", err
	}
	var box keybase1.EncryptedKVEntry
	err = msgpack.Decode(&box, decoded)
	if err != nil {
		mctx.Debug("msgpack decode error on boxed message: %v", err)
		return "", err
	}
	if box.V != 1 {
		return "", fmt.Errorf("unsupported secret box version: %v", box.V)
	}

	var encKey [signencrypt.SecretboxKeySize]byte
	if botUID != "" {
		encKey, _, err = b.fetchRestrictedBotEncryptionKey(mctx, entryID, botUID, &teamKeyGen)
		if err != nil {
			mctx.Debug("error fetching restricted bot decryption key: %v", err)
			return "", err
		}
	} else {
		encKey, _, err = b.fetchEncryptionKey(mctx, entryID, &teamKeyGen)
		if err != nil {
			mctx.Debug("error fetching decryption key: %v", err)
			return "", err
		}
	}
	verKey, err := b.fetchVerifyKey(mctx, senderUID, senderDeviceID)
	if err != nil {
		mctx.Debug("error fetching verify key: %v", err)
		return "", err
	}
	var nonce [signencrypt.NonceSize]byte
	if copy(nonce[:], box.N) != signencrypt.NonceSize {
		return "", libkb.DecryptBadNonceError{}
	}
	associatedData := kvStoreMetadata{
		EntryID:           entryID,
		Revision:          revision,
		EncKey:            encKey,
		CiphertextVersion: box.V,
		UID:               senderUID,
		EldestSeqno:       senderEldestSeqno,
		DeviceID:          senderDeviceID,
		BotUID:            botUID,
		BotEldestSeqno:    botEldestSeqno,
	}
	fmt.Printf(".....unbox AD = %+v\n", associatedData)

	// open it up
	clearBytes, err := signencrypt.OpenWithAssociatedData(box.E, associatedData, &encKey, verKey, kbcrypto.SignaturePrefixTeamStore, &nonce)
	if err != nil {
		return "", err
	}
	return string(clearBytes), nil
}
