package kvstore

import (
	"crypto/sha512"
	"encoding/base64"
	"encoding/binary"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/ed25519"
)

type KVStoreBoxer interface {
	Box(namespace, entryKey string, revision int, cleartextValue string) (ciphertext string, err error)
	Unbox(mctx libkb.MetaContext, namespace, entryKey string, revision int, ciphertext string,
		senderUID keybase1.UID, senderEldestSeqno keybase1.Seqno, senderDeviceID keybase1.DeviceID) (cleartext string, err error)
}

var _ KVStoreBoxer = (*KVStoreRealBoxer)(nil)

type KVStoreRealBoxer struct {
	libkb.Contextified
}

type Nonce [24]byte

func NewKVStoreBoxer(g *libkb.GlobalContext) *KVStoreRealBoxer {
	return &KVStoreRealBoxer{
		Contextified: libkb.NewContextified(g),
	}
}

func (b *KVStoreRealBoxer) sign(namespace, entryKey string, clearBytes []byte, revision int, nonce Nonce) (ret keybase1.ED25519Signature, err error) {
	// build the message
	msg, err := b.buildSignatureMsg(namespace, entryKey, clearBytes, revision, nonce)
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

func (b *KVStoreRealBoxer) verify(mctx libkb.MetaContext, namespace, entryKey string, revision int,
	clearBytes []byte, sig kbcrypto.NaclSignature, nonce Nonce,
	senderUID keybase1.UID, senderEldestSeqno keybase1.Seqno, senderDeviceID keybase1.DeviceID) (err error) {

	// build the expected message
	expectedInput, err := b.buildSignatureMsg(namespace, entryKey, clearBytes, revision, nonce)
	if err != nil {
		return err
	}
	// fetch the verify key for this user and device
	upk, err := b.G().GetUPAKLoader().LoadUPAKWithDeviceID(mctx.Ctx(), senderUID, senderDeviceID)
	if err != nil {
		return err
	}
	verifyKid, _ := upk.Current.FindSigningDeviceKID(senderDeviceID)
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

func (b *KVStoreRealBoxer) buildSignatureMsg(namespace, entryKey string, clearBytes []byte, revision int, nonce Nonce) (ret []byte, err error) {
	clearHash := sha512.Sum512(clearBytes)
	ret = append(ret, []byte(namespace)...)
	ret = append(ret, []byte(entryKey)...)
	ret = append(ret, clearHash[:]...)
	revBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(revBytes, uint32(revision))
	ret = append(ret, revBytes...)
	ret = append(ret, nonce[:]...)
	// encryptionkey
	return ret, nil
}

var temporarilyNotRandom Nonce

func newNonce() (ret Nonce, err error) {
	if temporarilyNotRandom != ret {
		// remove me when this is encrypted and the nonce matters
		return temporarilyNotRandom, nil
	}
	randBytes, err := libkb.RandBytes(24)
	if err != nil {
		return ret, err
	}
	copy(ret[:], randBytes)
	copy(temporarilyNotRandom[:], randBytes)
	return ret, nil
}

func (b *KVStoreRealBoxer) Box(namespace, entryKey string, revision int, cleartext string) (ciphertext string, err error) {
	clearBytes := []byte(cleartext)
	nonce, err := newNonce()
	if err != nil {
		return "", err
	}
	sig, err := b.sign(namespace, entryKey, clearBytes, revision, nonce)
	if err != nil {
		return "", err
	}
	var data []byte
	data = append(data, sig[:]...)
	data = append(data, clearBytes...)

	return base64.StdEncoding.EncodeToString(data), nil
}

func (b *KVStoreRealBoxer) Unbox(mctx libkb.MetaContext, namespace, entryKey string, revision int, ciphertext string,
	senderUID keybase1.UID, senderEldestSeqno keybase1.Seqno, senderDeviceID keybase1.DeviceID) (cleartext string, err error) {

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	nonce, _ := newNonce() // TODO: pull this from the box
	sigBytes := data[0:ed25519.SignatureSize]
	var sig kbcrypto.NaclSignature
	copy(sig[:], sigBytes)
	clearBytes := data[ed25519.SignatureSize:]

	err = b.verify(mctx, namespace, entryKey, revision, clearBytes, sig, nonce, senderUID, senderEldestSeqno, senderDeviceID)
	if err != nil {
		return "", err
	}
	return string(clearBytes), nil
}
