package teams

import (
	"fmt"

	"crypto/hmac"
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"errors"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/crypto/scrypt"
	"golang.org/x/net/context"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack/encoding/basex"
)

// How many random bytes are needed to create "Invite Key" token of
// chosen alphabet and length.
const SeitanRawIKeyLength = 10

// This is expected seitan token length, the secret "Invite Key" that
// is generated on one client and distributed to another via face-to-
// face meeting, use of a trusted courier etc.
//
// We only try to distinguish Seitan tokens from normal e-mail tokens
// via length so make sure they are never the same length. Right now
// server-trust e-mail tokens are 12 characters.
const SeitanEncodedIKeyLength = 16

// Key-Base 33 encoding. lower case letters except 'l' and digits except for '0' and '1'.
const KBase33EncodeStd = "abcdefghijkmnopqrstuvwxyz23456789"

var Base33Encoding = basex.NewEncoding(KBase33EncodeStd, SeitanRawIKeyLength, "")

// "Invite Key"
type SeitanIKey string

// "Packed Encrypted Invite Key"
// All following 3 structs should be considerd one. When any changes,
// Version in PEIKey has to be bumped up.
type SeitanPEIKey struct {
	_struct               bool `codec:",toarray"`
	Version               uint
	TeamKeyGeneration     keybase1.PerTeamKeyGeneration
	RandomNonce           keybase1.BoxNonce
	EncryptedIKeyAndLabel []byte // keybase1.SeitanIKeyAndLabel MsgPacked and encrypted
}

func GenerateIKey() (ikey SeitanIKey, err error) {
	rawKey, err := libkb.RandBytes(SeitanRawIKeyLength)
	if err != nil {
		return ikey, err
	}

	var encodedKey [SeitanEncodedIKeyLength]byte
	Base33Encoding.Encode(encodedKey[:], rawKey)

	var verify [SeitanRawIKeyLength]byte
	_, err = Base33Encoding.Decode(verify[:], encodedKey[:])
	if err != nil {
		return ikey, err
	}

	if !libkb.SecureByteArrayEq(verify[:], rawKey) {
		return ikey, errors.New("Internal error - ikey encoding failed")
	}

	ikey = SeitanIKey(encodedKey[:])
	return ikey, nil
}

// GenerateIKeyFromString safely creates SeitanIKey value from
// plaintext string. Only length is checked - any 16-character token
// can be "Invite Key". Alphabet is not checked, as it is only a hint
// for token generation and it can change over time, but we assume
// that token length stays the same.
func GenerateIKeyFromString(token string) (ikey SeitanIKey, err error) {
	if len(token) != SeitanEncodedIKeyLength {
		return ikey, fmt.Errorf("invalid token length: expected %d characters, got %d", SeitanEncodedIKeyLength, len(token))
	}

	return SeitanIKey(token), nil
}

func (ikey SeitanIKey) String() string {
	return string(ikey)
}

const (
	SeitanScryptCost   = 1 << 10
	SeitanScryptR      = 8
	SeitanScryptP      = 1
	SeitanScryptKeylen = 32
)

// "Stretched Invite Key"
type SeitanSIKey [SeitanScryptKeylen]byte

func (ikey SeitanIKey) GenerateSIKey() (sikey SeitanSIKey, err error) {
	ret, err := scrypt.Key([]byte(ikey), nil, SeitanScryptCost, SeitanScryptR, SeitanScryptP, SeitanScryptKeylen)
	if err != nil {
		return sikey, err
	}
	copy(sikey[:], ret)
	return sikey, nil
}

func (sikey SeitanSIKey) GenerateTeamInviteID() (id SCTeamInviteID, err error) {
	type InviteStagePayload struct {
		Stage string `codec:"stage" json:"stage"`
	}

	payload, err := libkb.MsgpackEncode(InviteStagePayload{Stage: "invite_id"})
	if err != nil {
		return id, err
	}

	mac := hmac.New(sha512.New, sikey[:])
	_, err = mac.Write(payload)
	if err != nil {
		return id, err
	}

	out := mac.Sum(nil)
	out = out[0:15]
	out = append(out, libkb.InviteIDTag)
	id = SCTeamInviteID(hex.EncodeToString(out[:]))
	return id, nil
}

func (ikey SeitanIKey) generatePackedEncryptedIKeyWithSecretKey(secretKey keybase1.Bytes32, gen keybase1.PerTeamKeyGeneration, nonce keybase1.BoxNonce, label keybase1.SeitanIKeyLabel) (peikey SeitanPEIKey, encoded string, err error) {
	var keyAndLabel keybase1.SeitanIKeyAndLabelVersion1
	keyAndLabel.I = keybase1.SeitanIKey(ikey)
	keyAndLabel.L = label

	packedKeyAndLabel, err := libkb.MsgpackEncode(keybase1.NewSeitanIKeyAndLabelWithV1(keyAndLabel))
	if err != nil {
		return peikey, encoded, err
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = secretKey
	var naclNonce [libkb.NaclDHNonceSize]byte = nonce
	encryptedIKeyAndLabel := secretbox.Seal(nil, []byte(packedKeyAndLabel), &naclNonce, &encKey)

	peikey = SeitanPEIKey{
		Version:               1,
		TeamKeyGeneration:     gen,
		RandomNonce:           nonce,
		EncryptedIKeyAndLabel: encryptedIKeyAndLabel,
	}

	packed, err := libkb.MsgpackEncode(peikey)
	if err != nil {
		return peikey, encoded, err
	}

	encoded = base64.StdEncoding.EncodeToString(packed)
	return peikey, encoded, nil
}

func (ikey SeitanIKey) GeneratePackedEncryptedIKey(ctx context.Context, team *Team, label keybase1.SeitanIKeyLabel) (peikey SeitanPEIKey, encoded string, err error) {
	appKey, err := team.SeitanInviteTokenKey(ctx)
	if err != nil {
		return peikey, encoded, err
	}

	var nonce keybase1.BoxNonce
	if _, err = rand.Read(nonce[:]); err != nil {
		return peikey, encoded, err
	}

	return ikey.generatePackedEncryptedIKeyWithSecretKey(appKey.Key, appKey.KeyGeneration, nonce, label)
}

func SeitanDecodePEIKey(base64Buffer string) (peikey SeitanPEIKey, err error) {
	packed, err := base64.StdEncoding.DecodeString(base64Buffer)
	if err != nil {
		return peikey, err
	}

	err = libkb.MsgpackDecode(&peikey, packed)
	return peikey, err
}

func (peikey SeitanPEIKey) decryptIKeyAndLabelWithSecretKey(secretKey keybase1.Bytes32) (ret keybase1.SeitanIKeyAndLabel, err error) {
	var encKey [libkb.NaclSecretBoxKeySize]byte = secretKey
	var naclNonce [libkb.NaclDHNonceSize]byte = peikey.RandomNonce
	plain, ok := secretbox.Open(nil, peikey.EncryptedIKeyAndLabel, &naclNonce, &encKey)
	if !ok {
		return ret, errors.New("failed to decrypt seitan plain")
	}

	err = libkb.MsgpackDecode(&ret, plain)
	if err != nil {
		return ret, err
	}

	return ret, nil
}

func (peikey SeitanPEIKey) DecryptIKeyAndLabel(ctx context.Context, team *Team) (ret keybase1.SeitanIKeyAndLabel, err error) {
	appKey, err := team.ApplicationKeyAtGeneration(keybase1.TeamApplication_SEITAN_INVITE_TOKEN, peikey.TeamKeyGeneration)
	if err != nil {
		return ret, err
	}

	return peikey.decryptIKeyAndLabelWithSecretKey(appKey.Key)
}

// "Acceptance Key"
type SeitanAKey []byte

func (sikey SeitanSIKey) GenerateAcceptanceKey(uid keybase1.UID, eldestSeqno keybase1.Seqno, unixTime int64) (akey SeitanAKey, encoded string, err error) {
	type AKeyPayload struct {
		Stage       string         `codec:"stage" json:"stage"`
		UID         keybase1.UID   `codec:"uid" json:"uid"`
		EldestSeqno keybase1.Seqno `codec:"eldest_seqno" json:"eldest_seqno"`
		CTime       int64          `codec:"ctime" json:"ctime"`
	}

	payload, err := libkb.MsgpackEncode(AKeyPayload{
		Stage:       "accept",
		UID:         uid,
		EldestSeqno: eldestSeqno,
		CTime:       unixTime,
	})
	if err != nil {
		return akey, encoded, err
	}

	mac := hmac.New(sha512.New, sikey[:])
	_, err = mac.Write(payload)
	if err != nil {
		return akey, encoded, err
	}

	out := mac.Sum(nil)
	akey = out[:32]
	encoded = base64.StdEncoding.EncodeToString(akey)
	return akey, encoded, nil
}
