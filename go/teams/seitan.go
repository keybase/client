package teams

import (
	"bytes"

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

// Key-Base 34 encoding. lower case letters and digits except for 0 and 1.
const KBase34EncodeStd = "abcdefghijklmnopqrstuvwxyz23456789"

var Base34Encoding = basex.NewEncoding(KBase34EncodeStd, SeitanRawIKeyLength, "")

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
	Base34Encoding.Encode(encodedKey[:], rawKey)

	var verify [10]byte
	_, err = Base34Encoding.Decode(verify[:], encodedKey[:])
	if err != nil {
		return ikey, err
	}

	if !bytes.Equal(verify[:], rawKey) {
		return ikey, errors.New("Internal error - ikey encoding failed")
	}

	ikey = SeitanIKey(encodedKey[:])
	return ikey, nil
}

// "Stretched Invite Key"
type SeitanSIKey [32]byte

func (ikey SeitanIKey) GenerateSIKey() (sikey SeitanSIKey, err error) {
	ret, err := scrypt.Key([]byte(ikey), nil, 4, 8, 1, 32)
	if err != nil {
		return sikey, err
	}
	if len(ret) != 32 {
		return sikey, errors.New("internal error - scrypt did not return 32 bytes")
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

func (ikey SeitanIKey) GeneratePackedEncryptedIKey(ctx context.Context, team *Team) (peikey SeitanPEIKey, encoded string, err error) {
	appKey, err := team.SeitanInviteTokenKey(ctx)
	if err != nil {
		return peikey, encoded, err
	}

	var nonce keybase1.BoxNonce
	if _, err = rand.Read(nonce[:]); err != nil {
		return peikey, encoded, err
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = appKey.Key
	var naclNonce [libkb.NaclDHNonceSize]byte = nonce
	eikey := secretbox.Seal(nil, []byte(ikey), &naclNonce, &encKey)

	peikey = SeitanPEIKey{
		Version:           1,
		TeamKeyGeneration: appKey.KeyGeneration,
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

func SeitanDecodePEIKey(base64Buffer string) (peikey SeitanPEIKey, err error) {
	packed, err := base64.StdEncoding.DecodeString(base64Buffer)
	if err != nil {
		return peikey, err
	}

	err = libkb.MsgpackDecode(peikey, packed)
	return peikey, err
}

func (peikey SeitanPEIKey) DecryptIKey(ctx context.Context, team *Team) (ikey SeitanIKey, err error) {
	appKey, err := team.ApplicationKeyAtGeneration(keybase1.TeamApplication_SEITAN_INVITE_TOKEN, peikey.TeamKeyGeneration)
	if err != nil {
		return ikey, err
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = appKey.Key
	var naclNonce [libkb.NaclDHNonceSize]byte = peikey.RandomNonce
	plain, ok := secretbox.Open(nil, peikey.EIKey, &naclNonce, &encKey)
	if !ok {
		return ikey, errors.New("failed to decrypt seitan ikey")
	}

	ikey = SeitanIKey(plain)
	return ikey, nil
}
