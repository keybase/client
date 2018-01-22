package teams

import (
	"bytes"
	"fmt"
	"strings"

	"crypto/hmac"
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-crypto/ed25519"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// Seitan tokens v2 have a '+' as the sixth character. We use this
// to distinguish from email invite tokens (and team names).
// See `IsSeitanyV2`
const seitanEncodedIKeyV2PlusOffset = 6

// "Invite Key Version 2"
type SeitanIKeyV2 string

// "Packed Encrypted Invite Key Version 2"
// All following 3 structs should be considered one. When any changes,
// Version in PEPubKey has to be bumped up.
type SeitanPEPubKey struct {
	_struct              bool `codec:",toarray"`
	Version              uint
	TeamKeyGeneration    keybase1.PerTeamKeyGeneration
	RandomNonce          keybase1.BoxNonce
	EncryptedKeyAndLabel []byte // keybase1.SeitanPubKeyAndLabel MsgPacked and encrypted
}

func GenerateIKeyV2() (ikey SeitanIKeyV2, err error) {
	buf, err := generateIKey(seitanEncodedIKeyV2PlusOffset)
	if err != nil {
		return ikey, err
	}
	return SeitanIKeyV2(string(buf)), err
}

// IsSeitany is a very conservative check of whether a given string looks
// like a Seitan token. We want to err on the side of considering strings
// Seitan tokens, since we don't mistakenly want to send botched Seitan
// tokens to the server.
func IsSeitanyV2(s string) bool {
	return len(s) > seitanEncodedIKeyV2PlusOffset && strings.IndexByte(s, '+') > 1
}

// GenerateIKeyV2FromString safely creates SeitanIKey value from
// plaintext string. Only format is checked - any 18-character token
// with '+' character at position 6 can be "Invite Key". Alphabet is
// not checked, as it is only a hint for token generation and it can
// change over time, but we assume that token length stays the same.
func GenerateIKeyV2FromString(token string) (ikey SeitanIKeyV2, err error) {
	if len(token) != SeitanEncodedIKeyLength {
		return ikey, fmt.Errorf("invalid token length: expected %d characters, got %d", SeitanEncodedIKeyLength, len(token))
	}
	if token[seitanEncodedIKeyV2PlusOffset] != '+' {
		return ikey, fmt.Errorf("invalid token format: expected %dth character to be '+'", seitanEncodedIKeyV2PlusOffset+1)
	}

	return SeitanIKeyV2(strings.ToLower(token)), nil
}

func (ikey SeitanIKeyV2) String() string {
	return strings.ToLower(string(ikey))
}

// "Stretched Invite Key"
type SeitanSIKeyV2 [SeitanScryptKeylen]byte

func (ikey SeitanIKeyV2) GenerateSIKey() (sikey SeitanSIKeyV2, err error) {
	sikeyv1, err := SeitanIKey(ikey).GenerateSIKey()
	return SeitanSIKeyV2(sikeyv1), err
}

func (sikey SeitanSIKeyV2) GenerateTeamInviteID() (id SCTeamInviteID, err error) {
	type InviteStagePayload struct {
		Stage   string `codec:"stage" json:"stage"`
		Version int    `codec:"version" json:"version"`
	}

	payload, err := libkb.MsgpackEncode(InviteStagePayload{
		Stage:   "invite_id",
		Version: 2,
	})
	if err != nil {
		return id, err
	}
	return generateTeamInviteID(sikey[:], payload)
}

func (sikey SeitanSIKeyV2) generateKeyPair() (key libkb.NaclSigningKeyPair, err error) {
	type PrivateKeySeedPayload struct {
		Stage   string `codec:"stage" json:"stage"`
		Version int    `codec:"version" json:"version"`
	}

	payload, err := libkb.MsgpackEncode(PrivateKeySeedPayload{
		Stage:   "eddsa",
		Version: 2,
	})
	if err != nil {
		return key, err
	}

	mac := hmac.New(sha512.New, sikey[:])
	_, err = mac.Write(payload)
	if err != nil {
		return key, err
	}

	seed := mac.Sum(nil)
	seed = seed[0:32]
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(seed))
	if err != nil {
		return key, err
	}

	copy(key.Public[:], pub[:])
	key.Private = &libkb.NaclSigningKeyPrivate{}
	copy(key.Private[:], priv[:])
	return key, nil
}

func (ikey SeitanIKeyV2) generatePackedEncryptedKeyWithSecretKey(secretKey keybase1.Bytes32, gen keybase1.PerTeamKeyGeneration, nonce keybase1.BoxNonce, label keybase1.SeitanKeyLabel) (pepubkey SeitanPEPubKey, encoded string, err error) {

	sikey, err := ikey.GenerateSIKey()
	if err != nil {
		return pepubkey, encoded, err
	}

	keyPair, err := sikey.generateKeyPair()
	if err != nil {
		return pepubkey, encoded, err
	}

	var keyAndLabel keybase1.SeitanKeyAndLabelVersion2
	keyAndLabel.K = keybase1.SeitanPubKey(keyPair.GetKID().String())
	keyAndLabel.L = label

	packedKeyAndLabel, err := libkb.MsgpackEncode(keybase1.NewSeitanKeyAndLabelWithV2(keyAndLabel))
	if err != nil {
		return pepubkey, encoded, err
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = secretKey
	var naclNonce [libkb.NaclDHNonceSize]byte = nonce
	encryptedPubKeyAndLabel := secretbox.Seal(nil, []byte(packedKeyAndLabel), &naclNonce, &encKey)

	pepubkey = SeitanPEPubKey{
		Version:              2,
		TeamKeyGeneration:    gen,
		RandomNonce:          nonce,
		EncryptedKeyAndLabel: encryptedPubKeyAndLabel,
	}

	packed, err := libkb.MsgpackEncode(pepubkey)
	if err != nil {
		return pepubkey, encoded, err
	}

	encoded = base64.StdEncoding.EncodeToString(packed)
	return pepubkey, encoded, nil
}

func (ikey SeitanIKeyV2) GeneratePackedEncryptedKey(ctx context.Context, team *Team, label keybase1.SeitanKeyLabel) (pepubkey SeitanPEPubKey, encoded string, err error) {
	appKey, err := team.SeitanInviteTokenKeyLatest(ctx)
	if err != nil {
		return pepubkey, encoded, err
	}

	var nonce keybase1.BoxNonce
	if _, err = rand.Read(nonce[:]); err != nil {
		return pepubkey, encoded, err
	}

	return ikey.generatePackedEncryptedKeyWithSecretKey(appKey.Key, appKey.KeyGeneration, nonce, label)
}

func SeitanDecodePEPubKey(base64Buffer string) (pepubkey SeitanPEPubKey, err error) {
	packed, err := base64.StdEncoding.DecodeString(base64Buffer)
	if err != nil {
		return pepubkey, err
	}

	err = libkb.MsgpackDecode(&pepubkey, packed)
	return pepubkey, err
}

func (pepubkey SeitanPEPubKey) decryptKeyAndLabelWithSecretKey(secretKey keybase1.Bytes32) (ret keybase1.SeitanKeyAndLabel, err error) {
	var encKey [libkb.NaclSecretBoxKeySize]byte = secretKey
	var naclNonce [libkb.NaclDHNonceSize]byte = pepubkey.RandomNonce
	plain, ok := secretbox.Open(nil, pepubkey.EncryptedKeyAndLabel, &naclNonce, &encKey)
	if !ok {
		return ret, errors.New("failed to decrypt seitan plain")
	}

	err = libkb.MsgpackDecode(&ret, plain)
	if err != nil {
		return ret, err
	}

	return ret, nil
}

func (pepubkey SeitanPEPubKey) DecryptKeyAndLabel(ctx context.Context, team *Team) (ret keybase1.SeitanKeyAndLabel, err error) {
	appKey, err := team.SeitanInviteTokenKeyAtGeneration(ctx, pepubkey.TeamKeyGeneration)
	if err != nil {
		return ret, err
	}

	return pepubkey.decryptKeyAndLabelWithSecretKey(appKey.Key)
}

// "Signature"
type SeitanSig libkb.NaclSignature
type SeitanPubKey libkb.NaclSigningKeyPublic

func GenerateSeitanSignatureMessage(uid keybase1.UID, eldestSeqno keybase1.Seqno, inviteID SCTeamInviteID, time keybase1.Time) (payload []byte, err error) {
	type SigPayload struct {
		Stage       string         `codec:"stage" json:"stage"`
		UID         keybase1.UID   `codec:"uid" json:"uid"`
		EldestSeqno keybase1.Seqno `codec:"eldest_seqno" json:"eldest_seqno"`
		CTime       keybase1.Time  `codec:"ctime" json:"ctime"`
		InviteID    SCTeamInviteID `codec:"invite_id" json:"invite_id"`
		Version     int            `codec:"version" json:"version"`
	}

	payload, err = libkb.MsgpackEncode(SigPayload{
		Stage:       "accept",
		Version:     2,
		InviteID:    inviteID,
		UID:         uid,
		EldestSeqno: eldestSeqno,
		CTime:       time,
	})
	return payload, err
}

func VerifySeitanSignatureMessage(pubKey SeitanPubKey, msg []byte, sig SeitanSig) bool {
	naclsig := libkb.NaclSignature(sig)
	return libkb.NaclSigningKeyPublic(pubKey).Verify(msg, &naclsig)
}

func ImportSeitanPubKey(keyString keybase1.SeitanPubKey) (pubKey SeitanPubKey, err error) {
	keypair, err := libkb.ImportNaclSigningKeyPairFromHex(string(keyString))
	if err != nil {
		return pubKey, err
	}
	return SeitanPubKey(keypair.Public), nil
}

func (sikey SeitanSIKeyV2) GenerateSignature(uid keybase1.UID, eldestSeqno keybase1.Seqno, inviteID SCTeamInviteID, time keybase1.Time) (sig SeitanSig, encoded string, err error) {
	payload, err := GenerateSeitanSignatureMessage(uid, eldestSeqno, inviteID, time)
	if err != nil {
		return sig, encoded, err
	}

	keyPair, err := sikey.generateKeyPair()
	if err != nil {
		return sig, encoded, err
	}

	sig = SeitanSig(*keyPair.Private.Sign(payload))
	encoded = base64.StdEncoding.EncodeToString(sig[:])
	return sig, encoded, nil
}
