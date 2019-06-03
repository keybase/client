package teams

import (
	"fmt"
	"regexp"
	"strings"

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
	msgpack "github.com/keybase/client/go/msgpack"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// This is expected seitan token length, the secret "Invite Key" that
// is generated on one client and distributed to another via face-to-
// face meeting, use of a trusted courier etc.
//
// Seitan tokens have a '+' as the fifth character. We use this
// to distinguish from email invite tokens (and team names).
// See `IsSeitany`
const SeitanEncodedIKeyLength = 18
const seitanEncodedIKeyPlusOffset = 5

// Key-Base 30 encoding. lower case letters except "ilot", and digits except for '0' and '1'.
// See TestSeitanParams for a test to make sure these two parameters match up.
const KBase30EncodeStd = "abcdefghjkmnpqrsuvwxyz23456789"
const base30BitMask = byte(0x1f)

type SeitanVersion uint

const (
	SeitanVersion1 SeitanVersion = 1
	SeitanVersion2 SeitanVersion = 2
)

// "Invite Key"
type SeitanIKey string

// "Seitan Packed Encrypted Key" All following 3 structs should be considered one.
// When any changes, version has to be bumped up.
type SeitanPKey struct {
	_struct              bool `codec:",toarray"`
	Version              SeitanVersion
	TeamKeyGeneration    keybase1.PerTeamKeyGeneration
	RandomNonce          keybase1.BoxNonce
	EncryptedKeyAndLabel []byte // keybase1.SeitanKeyAndLabel MsgPacked and encrypted
}

func generateIKey(plusOffset int) (str string, err error) {

	alphabet := []byte(KBase30EncodeStd)
	randEncodingByte := func() (byte, error) {
		for {
			var b [1]byte
			_, err := rand.Read(b[:])
			if err != nil {
				return byte(0), err
			}
			i := int(b[0] & base30BitMask)
			if i < len(alphabet) {
				return alphabet[i], nil
			}
		}
	}

	var buf []byte
	for i := 0; i < SeitanEncodedIKeyLength; i++ {
		if i == plusOffset {
			buf = append(buf, '+')
		} else {
			b, err := randEncodingByte()
			if err != nil {
				return "", err
			}
			buf = append(buf, b)
		}
	}
	return string(buf), nil
}

func GenerateIKey() (ikey SeitanIKey, err error) {
	str, err := generateIKey(seitanEncodedIKeyPlusOffset)
	if err != nil {
		return ikey, err
	}
	return SeitanIKey(str), err
}

var tokenPasteRegexp = regexp.MustCompile(`token\: [a-z0-9+]{16,18}`)

// Returns the string that might be the token, and whether the content looked like a token paste.
func ParseSeitanTokenFromPaste(token string) (string, bool) {
	// If the person pasted the whole seitan SMS message in, then let's parse out the token
	if strings.Contains(token, "token: ") {
		m := tokenPasteRegexp.FindStringSubmatch(token)
		if len(m) == 1 {
			return strings.Split(m[0], " ")[1], true
		}
		return token, true
	}
	if IsSeitany(token) {
		return token, true
	}
	return token, false
}

// ParseIKeyFromString safely creates SeitanIKey value from
// plaintext string. Only format is checked - any 18-character token
// with '+' character at position 5 can be "Invite Key". Alphabet is
// not checked, as it is only a hint for token generation and it can
// change over time, but we assume that token length stays the same.
func ParseIKeyFromString(token string) (ikey SeitanIKey, err error) {
	if len(token) != SeitanEncodedIKeyLength {
		return ikey, fmt.Errorf("invalid token length: expected %d characters, got %d", SeitanEncodedIKeyLength, len(token))
	}
	if token[seitanEncodedIKeyPlusOffset] != '+' {
		return ikey, fmt.Errorf("invalid token format: expected %dth character to be '+'", seitanEncodedIKeyPlusOffset+1)
	}

	return SeitanIKey(strings.ToLower(token)), nil
}

func (ikey SeitanIKey) String() string {
	return strings.ToLower(string(ikey))
}

const (
	SeitanScryptCost   = 1 << 10
	SeitanScryptR      = 8
	SeitanScryptP      = 1
	SeitanScryptKeylen = 32
)

// "Stretched Invite Key"
type SeitanSIKey [SeitanScryptKeylen]byte

func generateSIKey(s string) (buf []byte, err error) {
	buf, err = scrypt.Key([]byte(s), nil, SeitanScryptCost, SeitanScryptR, SeitanScryptP, SeitanScryptKeylen)
	return buf, err
}

func (ikey SeitanIKey) GenerateSIKey() (sikey SeitanSIKey, err error) {
	buf, err := generateSIKey(ikey.String())
	if err != nil {
		return sikey, err
	}
	copy(sikey[:], buf)
	return sikey, nil
}

func generateTeamInviteID(secretKey []byte, payload []byte) (id SCTeamInviteID, err error) {
	mac := hmac.New(sha512.New, secretKey)
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

func (sikey SeitanSIKey) GenerateTeamInviteID() (id SCTeamInviteID, err error) {
	type InviteStagePayload struct {
		Stage string `codec:"stage" json:"stage"`
	}

	payload, err := msgpack.Encode(InviteStagePayload{Stage: "invite_id"})
	if err != nil {
		return id, err
	}
	return generateTeamInviteID(sikey[:], payload)
}

func packAndEncryptKeyWithSecretKey(secretKey keybase1.Bytes32, gen keybase1.PerTeamKeyGeneration, nonce keybase1.BoxNonce, packedKeyAndLabel []byte, version SeitanVersion) (pkey SeitanPKey, encoded string, err error) {
	var encKey [libkb.NaclSecretBoxKeySize]byte = secretKey
	var naclNonce [libkb.NaclDHNonceSize]byte = nonce
	encryptedKeyAndLabel := secretbox.Seal(nil, []byte(packedKeyAndLabel), &naclNonce, &encKey)

	pkey = SeitanPKey{
		Version:              version,
		TeamKeyGeneration:    gen,
		RandomNonce:          nonce,
		EncryptedKeyAndLabel: encryptedKeyAndLabel,
	}

	packed, err := msgpack.Encode(pkey)
	if err != nil {
		return pkey, encoded, err
	}

	encoded = base64.StdEncoding.EncodeToString(packed)
	return pkey, encoded, nil
}

func (ikey SeitanIKey) generatePackedEncryptedKeyWithSecretKey(secretKey keybase1.Bytes32, gen keybase1.PerTeamKeyGeneration, nonce keybase1.BoxNonce, label keybase1.SeitanKeyLabel) (pkey SeitanPKey, encoded string, err error) {
	var keyAndLabel keybase1.SeitanKeyAndLabelVersion1
	keyAndLabel.I = keybase1.SeitanIKey(ikey)
	keyAndLabel.L = label

	packedKeyAndLabel, err := msgpack.Encode(keybase1.NewSeitanKeyAndLabelWithV1(keyAndLabel))
	if err != nil {
		return pkey, encoded, err
	}
	return packAndEncryptKeyWithSecretKey(secretKey, gen, nonce, packedKeyAndLabel, SeitanVersion1)
}

func (ikey SeitanIKey) GeneratePackedEncryptedKey(ctx context.Context, team *Team, label keybase1.SeitanKeyLabel) (pkey SeitanPKey, encoded string, err error) {
	appKey, err := team.SeitanInviteTokenKeyLatest(ctx)
	if err != nil {
		return pkey, encoded, err
	}

	var nonce keybase1.BoxNonce
	if _, err = rand.Read(nonce[:]); err != nil {
		return pkey, encoded, err
	}

	return ikey.generatePackedEncryptedKeyWithSecretKey(appKey.Key, appKey.KeyGeneration, nonce, label)
}

func SeitanDecodePKey(base64Buffer string) (pkey SeitanPKey, err error) {
	packed, err := base64.StdEncoding.DecodeString(base64Buffer)
	if err != nil {
		return pkey, err
	}

	err = msgpack.Decode(&pkey, packed)
	return pkey, err
}

func (pkey SeitanPKey) decryptKeyAndLabelWithSecretKey(secretKey keybase1.Bytes32) (ret keybase1.SeitanKeyAndLabel, err error) {
	var encKey [libkb.NaclSecretBoxKeySize]byte = secretKey
	var naclNonce [libkb.NaclDHNonceSize]byte = pkey.RandomNonce
	plain, ok := secretbox.Open(nil, pkey.EncryptedKeyAndLabel, &naclNonce, &encKey)
	if !ok {
		return ret, errors.New("failed to decrypt seitan plain")
	}

	err = msgpack.Decode(&ret, plain)
	if err != nil {
		return ret, err
	}

	return ret, nil
}

func (pkey SeitanPKey) DecryptKeyAndLabel(ctx context.Context, team *Team) (ret keybase1.SeitanKeyAndLabel, err error) {
	appKey, err := team.SeitanInviteTokenKeyAtGeneration(ctx, pkey.TeamKeyGeneration)
	if err != nil {
		return ret, err
	}

	return pkey.decryptKeyAndLabelWithSecretKey(appKey.Key)
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

	payload, err := msgpack.Encode(AKeyPayload{
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
