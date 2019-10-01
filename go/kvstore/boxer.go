package kvstore

import (
	"encoding/base64"
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/ed25519"
	"golang.org/x/crypto/nacl/secretbox"
)

type KVStoreBoxer interface {
	Box(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, cleartextValue string) (ciphertext string,
		teamKeyGen keybase1.PerTeamKeyGeneration, ciphertextVersion int, err error)
	Unbox(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, ciphertext string, formatVersion int,
		senderUID keybase1.UID, senderEldestSeqno keybase1.Seqno, senderDeviceID keybase1.DeviceID) (cleartext string, err error)
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

type signatureElements struct {
	EntryID           keybase1.KVEntryID
	ClearBytes        []byte
	Revision          int
	Nonce             [24]byte
	EncKey            keybase1.Bytes32
	CiphertextVersion int
	UID               keybase1.UID
	EldestSeqno       keybase1.Seqno
	DeviceID          keybase1.DeviceID
}

func (b *KVStoreRealBoxer) sign(mctx libkb.MetaContext, sigElements signatureElements) (ret keybase1.ED25519Signature, err error) {
	// build the message
	msg, err := b.buildSignatureMsg(sigElements)
	if err != nil {
		return ret, err
	}
	// fetch this device's signing key
	signingKey, err := b.G().ActiveDevice.SigningKey()
	if err != nil {
		return ret, err
	}
	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return ret, libkb.KeyCannotSignError{}
	}
	// sign it
	sigInfo, err := kp.SignV2(msg, kbcrypto.SignaturePrefixTeamStore)
	if err != nil {
		return ret, err
	}
	return keybase1.ED25519Signature(sigInfo.Sig), nil
}

func (b *KVStoreRealBoxer) verify(mctx libkb.MetaContext, sig kbcrypto.NaclSignature, sigElements signatureElements) (err error) {
	// build the expected message
	expectedInput, err := b.buildSignatureMsg(sigElements)
	if err != nil {
		return err
	}
	// fetch the verify key for this user and device
	upk, err := b.G().GetUPAKLoader().LoadUPAKWithDeviceID(mctx.Ctx(), sigElements.UID, sigElements.DeviceID)
	if err != nil {
		return err
	}
	verifyKid, _ := upk.Current.FindSigningDeviceKID(sigElements.DeviceID)
	// verify it
	sigInfo := kbcrypto.NaclSigInfo{
		Kid:     verifyKid.ToBinaryKID(),
		Payload: expectedInput,
		Sig:     sig,
		Prefix:  kbcrypto.SignaturePrefixTeamStore,
		Version: 2,
	}
	_, err = sigInfo.Verify()
	return err
}

func (b *KVStoreRealBoxer) buildSignatureMsg(elements signatureElements) (ret []byte, err error) {
	return msgpack.Encode(elements)
}

func newNonce() (ret [24]byte, err error) {
	randBytes, err := libkb.RandBytes(24)
	if err != nil {
		return ret, err
	}
	copy(ret[:], randBytes)
	return ret, nil
}

func (b *KVStoreRealBoxer) fetchEncryptionKey(mctx libkb.MetaContext, entryID keybase1.KVEntryID, generation *keybase1.PerTeamKeyGeneration) (res keybase1.TeamApplicationKey, err error) {
	// boxing can always use the latest key, unboxing will pass in a team generation to load
	loadArg := keybase1.FastTeamLoadArg{
		ID:           entryID.TeamID,
		Applications: []keybase1.TeamApplication{keybase1.TeamApplication_KVSTORE},
	}
	if generation == nil {
		loadArg.NeedLatestKey = true
	} else {
		loadArg.KeyGenerationsNeeded = []keybase1.PerTeamKeyGeneration{*generation}
	}
	teamLoadRes, err := mctx.G().GetFastTeamLoader().Load(mctx, loadArg)
	if err != nil {
		return res, err
	}
	if len(teamLoadRes.ApplicationKeys) != 1 {
		return res, fmt.Errorf("wrong number of keys from fast-team-loading encryption key; wanted 1, got %d", len(teamLoadRes.ApplicationKeys))
	}
	appKey := teamLoadRes.ApplicationKeys[0]
	if generation != nil && appKey.KeyGeneration != *generation {
		return res, fmt.Errorf("wrong app key generation; wanted %d but got %d", *generation, appKey.KeyGeneration)
	}
	if appKey.Application != keybase1.TeamApplication_KVSTORE {
		return res, fmt.Errorf("wrong app key application; wanted %d but got %d", keybase1.TeamApplication_KVSTORE, appKey.Application)
	}
	return appKey, nil
}

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
	// get current key and team generation
	appKey, err := b.fetchEncryptionKey(mctx, entryID, nil)
	if err != nil {
		mctx.Debug("error fetching encryption key for entry %+v: %v", entryID, err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, err
	}
	teamGen := keybase1.PerTeamKeyGeneration(appKey.Generation())
	// build the signature
	thisDevice := mctx.G().ActiveDevice
	elements := signatureElements{
		EntryID:           entryID,
		ClearBytes:        clearBytes,
		Revision:          revision,
		Nonce:             nonce,
		EncKey:            appKey.Key,
		CiphertextVersion: ciphertextVersion,
		UID:               thisDevice.UserVersion().Uid,
		EldestSeqno:       thisDevice.UserVersion().EldestSeqno,
		DeviceID:          thisDevice.DeviceID(),
	}
	sig, err := b.sign(mctx, elements)
	if err != nil {
		mctx.Debug("error signing for entry %+v: %v", err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, err
	}
	// compose data to encrypt
	var data []byte
	data = append(data, sig[:]...)
	data = append(data, clearBytes...)
	// encrypt
	var encKey [libkb.NaclSecretBoxKeySize]byte = appKey.Key
	sealed := secretbox.Seal(nil, data, &nonce, &encKey)
	encrypted := keybase1.EncryptedKVEntry{
		V:   ciphertextVersion,
		E:   sealed,
		N:   nonce,
		Gen: teamGen,
	}
	// pack it, string it, ship it.
	packed, err := msgpack.Encode(encrypted)
	if err != nil {
		mctx.Debug("error msgpacking secretbox for entry %+v: %v", err)
		return "", keybase1.PerTeamKeyGeneration(0), 0, err
	}
	return base64.StdEncoding.EncodeToString(packed), teamGen, ciphertextVersion, nil
}

func (b *KVStoreRealBoxer) Unbox(mctx libkb.MetaContext, entryID keybase1.KVEntryID, revision int, ciphertext string,
	formatVersion int, senderUID keybase1.UID, senderEldestSeqno keybase1.Seqno,
	senderDeviceID keybase1.DeviceID) (cleartext string, err error) {

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
	// fetch the correct team application key for decryption
	generation := box.Gen
	appKey, err := b.fetchEncryptionKey(mctx, entryID, &generation)
	if err != nil {
		mctx.Debug("error fetching decryption key: %v", err)
		return "", err
	}
	nonce := box.N
	if box.V != 1 {
		return "", fmt.Errorf("unsupported secret box version: %v", box.V)
	}
	// open it up
	decrypted, ok := secretbox.Open(
		nil, box.E, (*[24]byte)(&box.N), (*[32]byte)(&appKey.Key))
	if !ok {
		mctx.Debug("decryption failed for entry %+v at revision %d", entryID, revision)
		return "", libkb.NewDecryptOpenError("kvstore secretbox")
	}
	// separate and verify the signature
	sigBytes := decrypted[0:ed25519.SignatureSize]
	var sig kbcrypto.NaclSignature
	copy(sig[:], sigBytes)
	clearBytes := decrypted[ed25519.SignatureSize:]
	sigElements := signatureElements{
		EntryID:           entryID,
		ClearBytes:        clearBytes,
		Revision:          revision,
		Nonce:             nonce,
		EncKey:            appKey.Key,
		CiphertextVersion: box.V,
		UID:               senderUID,
		EldestSeqno:       senderEldestSeqno,
		DeviceID:          senderDeviceID,
	}
	err = b.verify(mctx, sig, sigElements)
	if err != nil {
		mctx.Debug("signature did not verify for entry %+v at revision %d: %v", entryID, revision, err)
		return "", err
	}
	mctx.Debug("successfully decrypted and verified signature for entry %+v")
	return string(clearBytes), nil
}
