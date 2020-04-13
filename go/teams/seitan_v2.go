package teams

import (
	"bytes"
	"fmt"
	"strings"

	"crypto/hmac"
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/go-crypto/ed25519"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// Seitan tokens v2 have a '+' as the sixth character. We use this
// to distinguish from email invite tokens (and team names).
const seitanEncodedIKeyV2PlusOffset = 6

// "Invite Key Version 2"
type SeitanIKeyV2 string

func GenerateIKeyV2() (ikey SeitanIKeyV2, err error) {
	str, err := generateIKey(SeitanEncodedIKeyLength, seitanEncodedIKeyV2PlusOffset)
	if err != nil {
		return ikey, err
	}
	return SeitanIKeyV2(str), err
}

// ParseIKeyV2FromString safely creates SeitanIKey value from
// plaintext string. Only format is checked - any 18-character token
// with '+' character at position 6 can be "Invite Key". Alphabet is
// not checked, as it is only a hint for token generation and it can
// change over time, but we assume that token length stays the same.
func ParseIKeyV2FromString(token string) (ikey SeitanIKeyV2, err error) {
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
	buf, err := generateSIKey(ikey.String())
	if err != nil {
		return sikey, err
	}
	copy(sikey[:], buf)
	return sikey, nil
}

type SeitanVersionedInviteStagePayload struct {
	Stage   string        `codec:"stage" json:"stage"`
	Version SeitanVersion `codec:"version" json:"version"`
}

func NewSeitanInviteIDPayload(version SeitanVersion) SeitanVersionedInviteStagePayload {
	return SeitanVersionedInviteStagePayload{Stage: "invite_id", Version: version}
}

func (sikey SeitanSIKeyV2) GenerateTeamInviteID() (id SCTeamInviteID, err error) {

	payload, err := msgpack.Encode(NewSeitanInviteIDPayload(SeitanVersion2))
	if err != nil {
		return id, err
	}
	return generateTeamInviteID(sikey[:], payload)
}

func (sikey SeitanSIKeyV2) generateKeyPair() (key libkb.NaclSigningKeyPair, err error) {
	type PrivateKeySeedPayload struct {
		Stage   string        `codec:"stage" json:"stage"`
		Version SeitanVersion `codec:"version" json:"version"`
	}

	payload, err := msgpack.Encode(PrivateKeySeedPayload{
		Stage:   "eddsa",
		Version: SeitanVersion2,
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
	key.Private = &kbcrypto.NaclSigningKeyPrivate{}
	copy(key.Private[:], priv[:])
	return key, nil
}

func (sikey SeitanSIKeyV2) generatePackedEncryptedKeyWithSecretKey(secretKey keybase1.Bytes32, gen keybase1.PerTeamKeyGeneration, nonce keybase1.BoxNonce, label keybase1.SeitanKeyLabel) (pkey SeitanPKey, encoded string, err error) {

	keyPair, err := sikey.generateKeyPair()
	if err != nil {
		return pkey, encoded, err
	}

	var keyAndLabel keybase1.SeitanKeyAndLabelVersion2
	keyAndLabel.K = keybase1.SeitanPubKey(keyPair.GetKID().String())
	keyAndLabel.L = label

	packedKeyAndLabel, err := msgpack.Encode(keybase1.NewSeitanKeyAndLabelWithV2(keyAndLabel))
	if err != nil {
		return pkey, encoded, err
	}
	return packAndEncryptKeyWithSecretKey(secretKey, gen, nonce, packedKeyAndLabel, SeitanVersion2)
}

func (sikey SeitanSIKeyV2) GeneratePackedEncryptedKey(ctx context.Context, team *Team, label keybase1.SeitanKeyLabel) (pkey SeitanPKey, encoded string, err error) {
	appKey, err := team.SeitanInviteTokenKeyLatest(ctx)
	if err != nil {
		return pkey, encoded, err
	}

	var nonce keybase1.BoxNonce
	if _, err = rand.Read(nonce[:]); err != nil {
		return pkey, encoded, err
	}

	return sikey.generatePackedEncryptedKeyWithSecretKey(appKey.Key, appKey.KeyGeneration, nonce, label)
}

// "Signature"
type SeitanSig kbcrypto.NaclSignature
type SeitanPubKey kbcrypto.NaclSigningKeyPublic

func GenerateSeitanSignatureMessage(uid keybase1.UID, eldestSeqno keybase1.Seqno, inviteID SCTeamInviteID, time keybase1.Time) (payload []byte, err error) {
	type SigPayload struct {
		Stage       string         `codec:"stage" json:"stage"`
		UID         keybase1.UID   `codec:"uid" json:"uid"`
		EldestSeqno keybase1.Seqno `codec:"eldest_seqno" json:"eldest_seqno"`
		CTime       keybase1.Time  `codec:"ctime" json:"ctime"`
		InviteID    SCTeamInviteID `codec:"invite_id" json:"invite_id"`
		Version     SeitanVersion  `codec:"version" json:"version"`
	}

	payload, err = msgpack.Encode(SigPayload{
		Stage:       "accept",
		Version:     SeitanVersion2,
		InviteID:    inviteID,
		UID:         uid,
		EldestSeqno: eldestSeqno,
		CTime:       time,
	})
	return payload, err
}

func VerifySeitanSignatureMessage(pubKey SeitanPubKey, msg []byte, sig SeitanSig) error {
	naclsig := kbcrypto.NaclSignature(sig)
	valid := kbcrypto.NaclSigningKeyPublic(pubKey).Verify(msg, naclsig)
	if !valid {
		return libkb.KeyCannotVerifyError{}
	}
	return nil
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

	sig = SeitanSig(keyPair.Private.Sign(payload))
	encoded = base64.StdEncoding.EncodeToString(sig[:])
	return sig, encoded, nil
}
