// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/ed25519"
	"golang.org/x/crypto/nacl/box"
)

type NaclSignature [ed25519.SignatureSize]byte

type NaclSigInfo struct {
	Kid      keybase1.BinaryKID `codec:"key"`
	Payload  []byte             `codec:"payload,omitempty"`
	Sig      NaclSignature      `codec:"sig"`
	SigType  int                `codec:"sig_type"`
	HashType int                `codec:"hash_type"`
	Detached bool               `codec:"detached"`
	Version  int                `codec:"version,omitempty"`
	Prefix   SignaturePrefix    `codec:"prefix,omitempty"`
}

type NaclEncryptionInfo struct {
	Ciphertext     []byte `codec:"ciphertext"`
	EncryptionType int    `codec:"enc_type"`
	Nonce          []byte `codec:"nonce"`
	Receiver       []byte `codec:"receiver_key"`
	Sender         []byte `codec:"sender_key"`
}

const NaclDHKeysize = 32

// TODO: Ideally, ed25519 would expose how many random bytes it needs.
const NaclSigningKeySecretSize = 32

// TODO: Ideally, box would expose how many random bytes it needs.
const NaclDHKeySecretSize = 32

// Todo: Ideally, box would specify nonce size
const NaclDHNonceSize = 24

const NaclSecretBoxKeySize = 32

type NaclSigningKeyPublic [ed25519.PublicKeySize]byte
type NaclSigningKeyPrivate [ed25519.PrivateKeySize]byte

func (k NaclSigningKeyPrivate) Sign(msg []byte) *NaclSignature {
	var sig NaclSignature
	copy(sig[:], ed25519.Sign(k[:], msg))
	return &sig
}

func (k NaclSigningKeyPublic) Verify(msg []byte, sig *NaclSignature) bool {
	return ed25519.Verify(k[:], msg, sig[:])
}

type NaclSigningKeyPair struct {
	Public  NaclSigningKeyPublic
	Private *NaclSigningKeyPrivate
}

var _ GenericKey = NaclSigningKeyPair{}

type NaclDHKeyPublic [NaclDHKeysize]byte
type NaclDHKeyPrivate [NaclDHKeysize]byte

type NaclDHKeyPair struct {
	Public  NaclDHKeyPublic
	Private *NaclDHKeyPrivate
}

func (k NaclDHKeyPair) Clone() (ret NaclDHKeyPair) {
	ret.Public = k.Public
	if k.Private != nil {
		tmp := *k.Private
		ret.Private = &tmp
	}
	return ret
}

var _ GenericKey = NaclDHKeyPair{}

type NaclSecretBoxKey [NaclSecretBoxKeySize]byte

func importNaclHex(s string, typ byte, bodyLen int) (ret []byte, err error) {
	kid := keybase1.KIDFromString(s)
	return importNaclKid(kid.ToBytes(), typ, bodyLen)
}

func importNaclKid(bkid []byte, typ byte, bodyLen int) (ret []byte, err error) {
	l := len(bkid)
	if l != bodyLen+3 {
		err = BadKeyError{fmt.Sprintf("Wrong length; wanted %d, got %d", bodyLen+3, l)}
		return
	}

	if bkid[0] != byte(KeybaseKIDV1) || bkid[l-1] != byte(IDSuffixKID) || bkid[1] != typ {
		err = BadKeyError{"bad header or trailer bytes"}
		return
	}
	ret = bkid[2:(l - 1)]
	return
}

func ImportNaclSigningKeyPairFromBytes(pub []byte, priv []byte) (ret NaclSigningKeyPair, err error) {
	var body []byte
	if body, err = importNaclKid(pub, byte(KIDNaclEddsa), ed25519.PublicKeySize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	if priv == nil {
	} else if len(priv) != ed25519.PrivateKeySize {
		err = BadKeyError{"Secret key was wrong size"}
	} else {
		ret.Private = &NaclSigningKeyPrivate{}
		copy(ret.Private[:], priv)
	}
	return
}

func ImportKeypairFromKID(k keybase1.KID) (key GenericKey, err error) {
	kid := k.ToBytes()
	l := len(kid)
	if l < 3 {
		err = BadKeyError{"KID was way too short"}
		return
	}
	if kid[0] != byte(KeybaseKIDV1) || kid[l-1] != byte(IDSuffixKID) {
		err = BadKeyError{"bad header or trailer found"}
		return
	}
	raw := kid[2:(l - 1)]
	switch kid[1] {
	case byte(KIDNaclEddsa):
		if len(raw) != ed25519.PublicKeySize {
			err = BadKeyError{"Bad EdDSA key size"}
		} else {
			tmp := NaclSigningKeyPair{}
			copy(tmp.Public[:], raw)
			key = tmp
		}
	case byte(KIDNaclDH):
		if len(raw) != NaclDHKeysize {
			err = BadKeyError{"Bad DH key size"}
		} else {
			tmp := NaclDHKeyPair{}
			copy(tmp.Public[:], raw)
			key = tmp
		}
	default:
		err = BadKeyError{fmt.Sprintf("Bad key prefix: %d", kid[1])}
	}
	return
}

func ImportNaclSigningKeyPairFromHex(s string) (ret NaclSigningKeyPair, err error) {
	var body []byte
	if body, err = importNaclHex(s, byte(KIDNaclEddsa), ed25519.PublicKeySize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	return
}

func ImportNaclDHKeyPairFromBytes(pub []byte, priv []byte) (ret NaclDHKeyPair, err error) {
	var body []byte
	if body, err = importNaclKid(pub, byte(KIDNaclDH), NaclDHKeysize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	if priv == nil {
	} else if len(priv) != NaclDHKeysize {
		err = BadKeyError{"Secret key was wrong size"}
	} else {
		ret.Private = &NaclDHKeyPrivate{}
		copy(ret.Private[:], priv)
	}
	return
}

func ImportNaclDHKeyPairFromHex(s string) (ret NaclDHKeyPair, err error) {
	var body []byte
	if body, err = importNaclHex(s, byte(KIDNaclDH), NaclDHKeysize); err != nil {
		return
	}
	copy(ret.Public[:], body)
	return
}

func (k NaclDHKeyPublic) GetKID() keybase1.KID {
	return k.GetBinaryKID().ToKID()
}

func (k NaclDHKeyPublic) GetBinaryKID() keybase1.BinaryKID {
	prefix := []byte{
		byte(KeybaseKIDV1),
		byte(KIDNaclDH),
	}
	suffix := byte(IDSuffixKID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return keybase1.BinaryKID(out)
}

func (k NaclDHKeyPair) GetFingerprintP() *PGPFingerprint {
	return nil
}

func (k NaclDHKeyPair) GetAlgoType() AlgoType {
	return KIDNaclDH
}

func (k NaclSigningKeyPair) GetAlgoType() AlgoType {
	return KIDNaclEddsa
}

func (k NaclSigningKeyPublic) GetBinaryKID() keybase1.BinaryKID {
	prefix := []byte{
		byte(KeybaseKIDV1),
		byte(KIDNaclEddsa),
	}
	suffix := byte(IDSuffixKID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return keybase1.BinaryKID(out)
}

func (k NaclSigningKeyPublic) GetKID() keybase1.KID {
	return k.GetBinaryKID().ToKID()
}

func (k NaclSigningKeyPair) GetKID() (ret keybase1.KID) {
	return k.Public.GetKID()
}

func (k NaclSigningKeyPair) GetBinaryKID() (ret keybase1.BinaryKID) {
	return k.Public.GetBinaryKID()
}

func (k NaclSigningKeyPair) ToShortIDString() string {
	return k.Public.GetKID().ToShortIDString()
}

func (k NaclDHKeyPair) ToShortIDString() string {
	return k.Public.GetKID().ToShortIDString()
}

func (k NaclSigningKeyPair) VerboseDescription() string {
	return fmt.Sprintf("255-bit EdDSA signing key (%s)", k.ToShortIDString())
}
func (k NaclDHKeyPair) VerboseDescription() string {
	return fmt.Sprintf("255-bit Curve25519 DH key (%s)", k.ToShortIDString())
}

func (k NaclSigningKeyPair) GetFingerprintP() *PGPFingerprint {
	return nil
}

func (k NaclDHKeyPair) GetKID() keybase1.KID {
	return k.Public.GetKID()
}
func (k NaclDHKeyPair) GetBinaryKID() (ret keybase1.BinaryKID) {
	return k.Public.GetBinaryKID()
}

func (k NaclSigningKeyPair) CheckSecretKey() error {
	if k.Private == nil {
		return NoSecretKeyError{}
	}
	return nil
}

func (k NaclSigningKeyPair) HasSecretKey() bool {
	return k.Private != nil
}

func (k NaclSigningKeyPair) Encode() (string, error) {
	return k.GetKID().String(), nil
}

func (k NaclDHKeyPair) Encode() (string, error) {
	return k.GetKID().String(), nil
}

func (k NaclDHKeyPair) CheckSecretKey() error {
	if k.Private == nil {
		return NoSecretKeyError{}
	}
	return nil
}

func (k NaclDHKeyPair) HasSecretKey() bool {
	return k.Private != nil
}

func (k NaclSigningKeyPair) CanSign() bool { return k.Private != nil }
func (k NaclDHKeyPair) CanSign() bool      { return false }

func (k NaclSigningKeyPair) Sign(msg []byte) (ret *NaclSigInfo, err error) {
	if k.Private == nil {
		err = NoSecretKeyError{}
		return
	}

	// Version 0 is just over the unprefixed message (assume version 0 if no version present)
	// Version 1 is the same.
	ret = &NaclSigInfo{
		Kid:      k.GetBinaryKID(),
		Payload:  msg,
		Sig:      *k.Private.Sign(msg),
		SigType:  SigKbEddsa,
		HashType: HashPGPSha512,
		Detached: true,
		Version:  0,
	}
	return
}

func (k NaclSigningKeyPair) SecretSymmetricKey(reason EncryptionReason) (NaclSecretBoxKey, error) {
	return NaclSecretBoxKey{}, KeyCannotEncryptError{}
}

type SignaturePrefix string

const encryptionReasonMinLength = 8

type EncryptionReason string

func (p SignaturePrefix) hasNullByte() bool {
	return bytes.IndexByte([]byte(p), byte(0)) != -1
}

func (p SignaturePrefix) Prefix(msg []byte) []byte {
	prefix := append([]byte(p), 0)
	return append(prefix, msg...)
}

func (r EncryptionReason) Bytes() []byte {
	return []byte(r)
}

func (k NaclSigningKeyPair) SignV2(msg []byte, prefix SignaturePrefix) (ret *NaclSigInfo, err error) {
	if k.Private == nil {
		err = NoSecretKeyError{}
		return
	}

	if prefix.hasNullByte() || len(prefix) == 0 {
		err = BadSignaturePrefixError{}
		return
	}

	// Version 0 is just over the unprefixed message (assume version 0 if no version present)
	// Version 1 is the same.
	ret = &NaclSigInfo{
		Kid:      k.GetBinaryKID(),
		Payload:  msg,
		Sig:      *k.Private.Sign(prefix.Prefix(msg)),
		SigType:  SigKbEddsa,
		HashType: HashPGPSha512,
		Detached: true,
		Version:  2,
		Prefix:   prefix,
	}
	return
}

func (k NaclSigningKeyPair) SignToString(msg []byte) (sig string, id keybase1.SigID, err error) {
	naclSig, err := k.Sign(msg)
	if err != nil {
		return
	}

	packet, err := naclSig.ToPacket()
	if err != nil {
		return
	}

	body, err := packet.Encode()
	if err != nil {
		return
	}

	sig = base64.StdEncoding.EncodeToString(body)
	id = ComputeSigIDFromSigBody(body)
	return
}

func (k NaclSigningKeyPair) VerifyStringAndExtract(ctx VerifyContext, sig string) (msg []byte, id keybase1.SigID, err error) {
	var keyInSignature GenericKey
	var fullSigBody []byte
	keyInSignature, msg, fullSigBody, err = NaclVerifyAndExtract(sig)
	if err != nil {
		return
	}

	kidInSig := keyInSignature.GetKID()
	kidWanted := k.GetKID()
	if kidWanted.NotEqual(kidInSig) {
		err = WrongKidError{kidInSig, kidWanted}
		return
	}

	id = ComputeSigIDFromSigBody(fullSigBody)
	return
}

// NaclVerifyAndExtract interprets the given string as a NaCl-signed messaged, in
// the keybase NaclSigInfo (v1) format. It will check that the signature verified, and if so,
// will return the key that was used for the verification, the payload of the signature,
// the full body of the decoded SignInfo, and an error
func NaclVerifyAndExtract(s string) (key GenericKey, payload []byte, fullBody []byte, err error) {
	fullBody, err = base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, nil, nil, err
	}

	packet, err := DecodePacket(fullBody)
	if err != nil {
		return nil, nil, nil, err
	}

	naclSig, ok := packet.Body.(*NaclSigInfo)
	if !ok {
		err = UnmarshalError{"NACL signature"}
		return nil, nil, nil, err
	}

	var nk *NaclSigningKeyPublic
	nk, err = naclSig.Verify()
	if err != nil {
		return nil, nil, nil, err
	}

	key = NaclSigningKeyPair{Public: *nk}
	payload = naclSig.Payload
	return key, payload, fullBody, nil
}

func (k NaclSigningKeyPair) VerifyString(ctx VerifyContext, sig string, msg []byte) (id keybase1.SigID, err error) {
	extractedMsg, resID, err := k.VerifyStringAndExtract(ctx, sig)
	if err != nil {
		return
	}
	if !FastByteArrayEq(extractedMsg, msg) {
		err = BadSigError{"wrong payload"}
		return
	}
	id = resID
	return
}

func (k NaclDHKeyPair) SignToString(msg []byte) (sig string, id keybase1.SigID, err error) {
	err = KeyCannotSignError{}
	return
}

func (k NaclDHKeyPair) VerifyStringAndExtract(ctx VerifyContext, sig string) (msg []byte, id keybase1.SigID, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (k NaclDHKeyPair) VerifyString(ctx VerifyContext, sig string, msg []byte) (id keybase1.SigID, err error) {
	err = KeyCannotVerifyError{}
	return
}

func (s *NaclSigInfo) ToPacket() (ret *KeybasePacket, err error) {
	return NewKeybasePacket(s, TagSignature, KeybasePacketV1)
}

func (p KeybasePacket) ToNaclSigInfo() (*NaclSigInfo, error) {
	ret, ok := p.Body.(*NaclSigInfo)
	if !ok {
		return nil, UnmarshalError{"Signature"}
	}
	return ret, nil
}

func KIDToNaclSigningKeyPublic(bk []byte) *NaclSigningKeyPublic {
	if len(bk) != 3+ed25519.PublicKeySize {
		return nil
	}
	if bk[0] != byte(KeybaseKIDV1) || bk[1] != byte(KIDNaclEddsa) || bk[len(bk)-1] != byte(IDSuffixKID) {
		return nil
	}
	var ret NaclSigningKeyPublic
	copy(ret[:], bk[2:len(bk)-1])
	return &ret
}

func (s NaclSigInfo) Verify() (*NaclSigningKeyPublic, error) {
	key := KIDToNaclSigningKeyPublic(s.Kid)
	if key == nil {
		return nil, BadKeyError{}
	}

	switch s.Version {
	case 0, 1:
		if !key.Verify(s.Payload, &s.Sig) {
			return nil, VerificationError{}
		}
	case 2:
		if !key.Verify(s.Prefix.Prefix(s.Payload), &s.Sig) {
			return nil, VerificationError{}
		}
	default:
		return nil, UnhandledSignatureError{}
	}

	return key, nil
}

func (s *NaclSigInfo) ArmoredEncode() (ret string, err error) {
	return PacketArmoredEncode(s)
}

func (k NaclSigningKeyPair) ExportPublicAndPrivate() (RawPublicKey, RawPrivateKey, error) {
	return RawPublicKey(k.GetKID().ToBytes()), RawPrivateKey(k.Private[:]), nil
}

func (k NaclDHKeyPair) ExportPublicAndPrivate() (RawPublicKey, RawPrivateKey, error) {
	return RawPublicKey(k.GetKID().ToBytes()), RawPrivateKey(k.Private[:]), nil
}

func makeNaclSigningKeyPair(reader io.Reader) (NaclSigningKeyPair, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(reader)
	if err != nil {
		return NaclSigningKeyPair{}, err
	}

	var publicArray NaclSigningKeyPublic
	var privateArray NaclSigningKeyPrivate

	copy(publicArray[:], publicKey)
	copy(privateArray[:], privateKey)

	return NaclSigningKeyPair{
		Public:  publicArray,
		Private: &privateArray,
	}, nil
}

// MakeNaclSigningKeyPairFromSecret makes a signing key pair given a
// secret. Of course, the security of depends entirely on the
// randomness of the bytes in the secret.
func MakeNaclSigningKeyPairFromSecret(secret [NaclSigningKeySecretSize]byte) (NaclSigningKeyPair, error) {
	r := bytes.NewReader(secret[:])

	kp, err := makeNaclSigningKeyPair(r)
	if err != nil {
		return NaclSigningKeyPair{}, err
	}

	if r.Len() > 0 {
		return NaclSigningKeyPair{}, fmt.Errorf("Did not use %d secret byte(s)", r.Len())
	}

	return kp, err
}

func MakeNaclSigningKeyPairFromSecretBytes(secret []byte) (NaclSigningKeyPair, error) {
	if len(secret) != NaclSigningKeySecretSize {
		return NaclSigningKeyPair{}, fmt.Errorf("Bad NaCl signing key size: %d", len(secret))
	}
	var fixed [NaclSigningKeySecretSize]byte
	copy(fixed[:], secret)
	return MakeNaclSigningKeyPairFromSecret(fixed)
}

func GenerateNaclSigningKeyPair() (NaclSigningKeyPair, error) {
	return makeNaclSigningKeyPair(rand.Reader)
}

func makeNaclDHKeyPair(reader io.Reader) (NaclDHKeyPair, error) {
	pub, priv, err := box.GenerateKey(reader)
	if err != nil {
		return NaclDHKeyPair{}, err
	}
	return NaclDHKeyPair{
		Public:  *pub,
		Private: (*NaclDHKeyPrivate)(priv),
	}, nil
}

func MakeNaclDHKeyPairFromSecretBytes(secret []byte) (NaclDHKeyPair, error) {
	if len(secret) != NaclDHKeySecretSize {
		return NaclDHKeyPair{}, fmt.Errorf("Bad NaCl DH key size: %d", len(secret))
	}
	var fixed [NaclDHKeySecretSize]byte
	copy(fixed[:], secret)
	return MakeNaclDHKeyPairFromSecret(fixed)
}

// MakeNaclDHKeyPairFromSecret makes a DH key pair given a secret. Of
// course, the security of depends entirely on the randomness of the
// bytes in the secret.
func MakeNaclDHKeyPairFromSecret(secret [NaclDHKeySecretSize]byte) (NaclDHKeyPair, error) {
	r := bytes.NewReader(secret[:])

	kp, err := makeNaclDHKeyPair(r)
	if err != nil {
		return NaclDHKeyPair{}, err
	}

	if r.Len() > 0 {
		return NaclDHKeyPair{}, fmt.Errorf("Did not use %d secret byte(s)", r.Len())
	}

	return kp, err
}

func GenerateNaclDHKeyPair() (NaclDHKeyPair, error) {
	return makeNaclDHKeyPair(rand.Reader)
}

func KbOpenSig(armored string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(armored)
}

func SigExtractKbPayloadAndKID(armored string) (payload []byte, kid keybase1.KID, sigID keybase1.SigID, err error) {
	var byt []byte
	var packet *KeybasePacket
	var sig *NaclSigInfo
	var ok bool

	if byt, err = KbOpenSig(armored); err != nil {
		return nil, kid, sigID, err
	}

	if packet, err = DecodePacket(byt); err != nil {
		return nil, kid, sigID, err
	}
	if sig, ok = packet.Body.(*NaclSigInfo); !ok {
		err = UnmarshalError{"NaCl Signature"}
		return nil, kid, sigID, err
	}
	sigID = ComputeSigIDFromSigBody(byt)
	kid = sig.Kid.ToKID()
	payload = sig.Payload
	return payload, kid, sigID, nil
}

func SigAssertKbPayload(armored string, expected []byte) (sigID keybase1.SigID, err error) {
	var payload []byte
	nilSigID := keybase1.SigID("")
	payload, _, sigID, err = SigExtractKbPayloadAndKID(armored)
	if err != nil {
		return nilSigID, err
	}
	if !FastByteArrayEq(expected, payload) {
		return nilSigID, BadSigError{"wrong payload"}
	}
	return sigID, nil
}

// EncryptToString fails for this type of key.
func (k NaclSigningKeyPair) EncryptToString(plaintext []byte, sender GenericKey) (ciphertext string, err error) {
	err = KeyCannotEncryptError{}
	return
}

// DecryptFromString fails for this type of key.
func (k NaclSigningKeyPair) DecryptFromString(ciphertext string) (msg []byte, sender keybase1.KID, err error) {
	err = KeyCannotDecryptError{}
	return
}

// CanEncrypt always returns false for a signing key pair.
func (k NaclSigningKeyPair) CanEncrypt() bool { return false }

// CanDecrypt always returns false for a signing key pair.
func (k NaclSigningKeyPair) CanDecrypt() bool { return false }

// CanEncrypt always returns true for an encryption key pair.
func (k NaclDHKeyPair) CanEncrypt() bool { return true }

// CanDecrypt returns true if there's a private key available
func (k NaclDHKeyPair) CanDecrypt() bool { return k.Private != nil }

func (k NaclDHKeyPair) IsNil() bool {
	var empty NaclDHKeyPublic
	return bytes.Equal(k.Public[:], empty[:])
}

// Encrypt a message to the key `k` from the given `sender`. If sender is nil, an ephemeral
// keypair will be invented
func (k NaclDHKeyPair) Encrypt(msg []byte, sender *NaclDHKeyPair) (*NaclEncryptionInfo, error) {
	if sender == nil {
		if tmp, err := GenerateNaclDHKeyPair(); err == nil {
			sender = &tmp
		} else {
			return nil, err
		}
	} else if sender.Private == nil {
		return nil, NoSecretKeyError{}
	}

	var nonce [NaclDHNonceSize]byte
	if nRead, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	} else if nRead != NaclDHNonceSize {
		return nil, fmt.Errorf("Short random read: %d", nRead)
	}

	var ctext []byte
	ctext = box.Seal(ctext, msg, &nonce, ((*[32]byte)(&k.Public)), ((*[32]byte)(sender.Private)))
	ret := &NaclEncryptionInfo{
		Ciphertext:     ctext,
		EncryptionType: KIDNaclDH,
		Nonce:          nonce[:],
		Receiver:       k.GetKID().ToBytes(),
		Sender:         sender.GetKID().ToBytes(),
	}

	return ret, nil
}

// EncryptToString encrypts the plaintext using DiffieHelman; the this object is
// the receiver, and the passed sender is optional.  If not provided, we'll make
// up an ephemeral key.
func (k NaclDHKeyPair) EncryptToString(plaintext []byte, sender GenericKey) (string, error) {
	var senderDh *NaclDHKeyPair
	if sender != nil {
		var ok bool
		if senderDh, ok = sender.(*NaclDHKeyPair); !ok {
			return "", NoSecretKeyError{}
		}
	}

	info, err := k.Encrypt(plaintext, senderDh)
	if err != nil {
		return "", err
	}

	return PacketArmoredEncode(info)
}

func (k NaclDHKeyPair) SecretSymmetricKey(reason EncryptionReason) (NaclSecretBoxKey, error) {
	if !k.CanDecrypt() {
		return NaclSecretBoxKey{}, NoSecretKeyError{}
	}

	return deriveSymmetricKeyFromAsymmetric(*k.Private, reason)
}

// Derive a symmetric key using HMAC(k, reason).
// Suitable for deriving from an asymmetric encryption key.
// For deriving from a shared encryption key, this output is too close
// to something that might be used as a public authenticator.
func deriveSymmetricKeyFromAsymmetric(inKey NaclDHKeyPrivate, reason EncryptionReason) (NaclSecretBoxKey, error) {
	var outKey = [32]byte{}
	if len(reason) < encryptionReasonMinLength {
		return outKey, KeyGenError{Msg: "reason must be at least 8 bytes"}
	}

	mac := hmac.New(sha256.New, inKey[:])
	_, err := mac.Write(reason.Bytes())
	if err != nil {
		return outKey, err
	}
	out := mac.Sum(nil)

	if copy(outKey[:], out) != len(outKey) {
		return outKey, KeyGenError{Msg: "derived key of wrong size"}
	}

	return outKey, nil
}

// Derive a symmetric key.
// Uses HMAC(key=reason, data=key)
// Note the message and data are swapped as inputs to HMAC because that is less
// likely to be accidentally used for another purpose such as authentication.
func DeriveSymmetricKey(inKey NaclSecretBoxKey, reason EncryptionReason) (NaclSecretBoxKey, error) {
	var outKey = [32]byte{}
	if len(reason) < encryptionReasonMinLength {
		return outKey, KeyGenError{Msg: "reason must be at least 8 bytes"}
	}

	mac := hmac.New(sha256.New, []byte(reason))
	_, err := mac.Write(inKey[:])
	if err != nil {
		return outKey, err
	}
	out := mac.Sum(nil)

	if copy(outKey[:], out) != len(outKey) {
		return outKey, KeyGenError{Msg: "derived key of wrong size"}
	}

	return outKey, nil
}

// Derive a key from another.
// Uses HMAC(key=reason, data=key)
// Not to be confused with DeriveSymmetricKey which has hmac inputs swapped.
// This one makes sense for derivation from secrets used only to derive from.
func DeriveFromSecret(inKey [32]byte, reason DeriveReason) (outKey [32]byte, err error) {
	if len(reason) < 8 {
		return outKey, KeyGenError{Msg: "reason must be at least 8 bytes"}
	}

	mac := hmac.New(sha256.New, inKey[:])
	_, err = mac.Write([]byte(reason))
	if err != nil {
		return outKey, err
	}
	out := mac.Sum(nil)

	if copy(outKey[:], out) != len(outKey) {
		return outKey, KeyGenError{Msg: "derived key of wrong size"}
	}

	return outKey, nil
}

// ToPacket implements the Packetable interface.
func (k *NaclEncryptionInfo) ToPacket() (ret *KeybasePacket, err error) {
	return NewKeybasePacket(k, TagEncryption, KeybasePacketV1)
}

// DecryptFromString decrypts the output of EncryptToString above,
// and returns the KID of the other end.
func (k NaclDHKeyPair) DecryptFromString(ciphertext string) (msg []byte, sender keybase1.KID, err error) {
	var kbp *KeybasePacket
	var nei *NaclEncryptionInfo
	var ok bool

	if kbp, err = DecodeArmoredPacket(ciphertext); err != nil {
		return
	}

	if nei, ok = kbp.Body.(*NaclEncryptionInfo); !ok {
		err = UnmarshalError{"NaCl Encryption"}
		return
	}
	return k.Decrypt(nei)
}

// Decrypt a NaclEncryptionInfo packet, and on success return the plaintext
// and the KID of the sender (which might be an ephemeral key).
func (k NaclDHKeyPair) Decrypt(nei *NaclEncryptionInfo) (plaintext []byte, sender keybase1.KID, err error) {
	if k.Private == nil {
		err = NoSecretKeyError{}
		return
	}
	if nei.EncryptionType != KIDNaclDH {
		err = DecryptBadPacketTypeError{}
		return
	}
	var nonce [NaclDHNonceSize]byte
	if len(nei.Nonce) != NaclDHNonceSize {
		err = DecryptBadNonceError{}
		return
	}
	copy(nonce[:], nei.Nonce)

	var gk GenericKey
	if gk, err = ImportKeypairFromKID(keybase1.KIDFromSlice(nei.Sender)); err != nil {
		return
	}

	var senderDH NaclDHKeyPair
	var ok bool
	if senderDH, ok = gk.(NaclDHKeyPair); !ok {
		err = DecryptBadSenderError{}
		return
	}

	rkid := keybase1.KIDFromSlice(nei.Receiver)
	if k.GetKID().NotEqual(rkid) {
		err = DecryptWrongReceiverError{}
		return
	}

	if plaintext, ok = box.Open(plaintext, nei.Ciphertext, &nonce,
		((*[32]byte)(&senderDH.Public)), ((*[32]byte)(k.Private))); !ok {
		err = DecryptOpenError{}
		return
	}
	sender = senderDH.GetKID()
	return
}

func GeneratePerUserKeySeed() (res PerUserKeySeed, err error) {
	bs, err := RandBytes(32)
	if err != nil {
		return res, err
	}
	seed := PerUserKeySeed(MakeByte32(bs))
	return seed, nil
}
