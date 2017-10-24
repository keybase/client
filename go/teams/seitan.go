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

const SeitanRawIKeyLength = 10
const SeitanEncodedIKeyLength = 16

// Key-Base 33 encoding. lower case letters except 'l' and digits except for '0' and '1'.
const KBase33EncodeStd = "abcdefghijkmnopqrstuvwxyz23456789"

var Base33Encoding = basex.NewEncoding(KBase33EncodeStd, SeitanRawIKeyLength, "")

// "Invite Key"
type SeitanIKey string

// "Packed Encrypted Invite Key"
type SeitanPEIKey struct {
	_struct           bool `codec:",toarray"`
	Version           uint
	TeamKeyGeneration keybase1.PerTeamKeyGeneration
	RandomNonce       keybase1.BoxNonce
	EIKey             []byte
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

func (ikey SeitanIKey) generatePackedEncryptedIKeyWithSecretKey(secretKey keybase1.Bytes32, gen keybase1.PerTeamKeyGeneration, nonce keybase1.BoxNonce) (peikey SeitanPEIKey, encoded string, err error) {
	var encKey [libkb.NaclSecretBoxKeySize]byte = secretKey
	var naclNonce [libkb.NaclDHNonceSize]byte = nonce
	eikey := secretbox.Seal(nil, []byte(ikey), &naclNonce, &encKey)

	peikey = SeitanPEIKey{
		Version:           1,
		TeamKeyGeneration: gen,
		RandomNonce:       nonce,
		EIKey:             eikey,
	}

	packed, err := libkb.MsgpackEncode(peikey)
	if err != nil {
		return peikey, encoded, err
	}

	encoded = base64.StdEncoding.EncodeToString(packed)
	return peikey, encoded, nil
}

func (ikey SeitanIKey) GeneratePackedEncryptedIKey(ctx context.Context, team *Team) (peikey SeitanPEIKey, encoded string, err error) {
	appKey, err := team.SeitanInviteTokenKey(ctx)
	if err != nil {
		return peikey, encoded, err
	}

	var nonce keybase1.BoxNonce
	if _, err = rand.Read(nonce[:]); err != nil {
		return peikey, encoded, err
	}

	return ikey.generatePackedEncryptedIKeyWithSecretKey(appKey.Key, appKey.KeyGeneration, nonce)
}

func SeitanDecodePEIKey(base64Buffer string) (peikey SeitanPEIKey, err error) {
	packed, err := base64.StdEncoding.DecodeString(base64Buffer)
	if err != nil {
		return peikey, err
	}

	err = libkb.MsgpackDecode(&peikey, packed)
	return peikey, err
}

func (peikey SeitanPEIKey) decryptIKeyWithSecretKey(secretKey keybase1.Bytes32) (ikey SeitanIKey, err error) {
	var encKey [libkb.NaclSecretBoxKeySize]byte = secretKey
	var naclNonce [libkb.NaclDHNonceSize]byte = peikey.RandomNonce
	plain, ok := secretbox.Open(nil, peikey.EIKey, &naclNonce, &encKey)
	if !ok {
		return ikey, errors.New("failed to decrypt seitan ikey")
	}

	ikey = SeitanIKey(plain)
	return ikey, nil
}

func (peikey SeitanPEIKey) DecryptIKey(ctx context.Context, team *Team) (ikey SeitanIKey, err error) {
	appKey, err := team.ApplicationKeyAtGeneration(keybase1.TeamApplication_SEITAN_INVITE_TOKEN, peikey.TeamKeyGeneration)
	if err != nil {
		return ikey, err
	}

	return peikey.decryptIKeyWithSecretKey(appKey.Key)
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
