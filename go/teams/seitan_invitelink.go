package teams

import (
	"context"
	cryptorand "crypto/rand"
	"fmt"
	"regexp"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// documented in go/teams/seitan.go
const SeitanEncodedIKeyInvitelinkLength = 28
const seitanEncodedIKeyInvitelinkPlusOffset = 7

func GenerateSeitanIKeyInvitelink() (ikey keybase1.SeitanIKeyInvitelink, err error) {
	str, err := generateIKey(SeitanEncodedIKeyInvitelinkLength, seitanEncodedIKeyInvitelinkPlusOffset)
	if err != nil {
		return ikey, err
	}
	return keybase1.SeitanIKeyInvitelink(str), nil
}

func ParseIKeyInvitelinkFromString(token string) (ikey keybase1.SeitanIKeyInvitelink, err error) {
	if len(token) != SeitanEncodedIKeyInvitelinkLength {
		return ikey, fmt.Errorf("invalid token length: expected %d characters, got %d", SeitanEncodedIKeyLength, len(token))
	}

	return keybase1.SeitanIKeyInvitelink(strings.ToLower(token)), nil
}

type SeitanSIKeyInvitelink [SeitanScryptKeylen]byte

func GenerateSIKeyInvitelink(ikey keybase1.SeitanIKeyInvitelink) (sikey SeitanSIKeyInvitelink, err error) {
	buf, err := generateSIKey(ikey.String())
	if err != nil {
		return sikey, err
	}
	copy(sikey[:], buf)
	return sikey, nil
}

func (sikey SeitanSIKeyInvitelink) generateMsgpackPayload() ([]byte, error) {
	return msgpack.Encode(NewSeitanInviteIDPayload(SeitanVersionInvitelink))
}

func (sikey SeitanSIKeyInvitelink) GenerateTeamInviteID() (id SCTeamInviteID, err error) {
	payload, err := sikey.generateMsgpackPayload()
	if err != nil {
		return id, err
	}
	return generateTeamInviteID(sikey[:], payload)
}

func (sikey SeitanSIKeyInvitelink) GenerateShortTeamInviteID() (id SCTeamInviteIDShort, err error) {
	payload, err := sikey.generateMsgpackPayload()
	if err != nil {
		return id, err
	}
	return generateShortTeamInviteID(sikey[:], payload)
}

func generatePackedEncryptedKeyWithSecretKeyInvitelink(ikey keybase1.SeitanIKeyInvitelink,
	secretKey keybase1.Bytes32, gen keybase1.PerTeamKeyGeneration, nonce keybase1.BoxNonce,
	label keybase1.SeitanKeyLabel) (pkey SeitanPKey, encoded string, err error) {
	var keyAndLabel keybase1.SeitanKeyAndLabelInvitelink
	keyAndLabel.I = ikey
	keyAndLabel.L = label

	packedKeyAndLabel, err := msgpack.Encode(keybase1.NewSeitanKeyAndLabelWithInvitelink(keyAndLabel))
	if err != nil {
		return pkey, encoded, err
	}
	return packAndEncryptKeyWithSecretKey(secretKey, gen, nonce, packedKeyAndLabel, SeitanVersionInvitelink)
}

func GeneratePackedEncryptedKeyInvitelink(ctx context.Context, ikey keybase1.SeitanIKeyInvitelink,
	team *Team, label keybase1.SeitanKeyLabel) (pkey SeitanPKey, encoded string, err error) {
	appKey, err := team.SeitanInviteTokenKeyLatest(ctx)
	if err != nil {
		return pkey, encoded, err
	}

	var nonce keybase1.BoxNonce
	if _, err = cryptorand.Read(nonce[:]); err != nil {
		return pkey, encoded, err
	}

	return generatePackedEncryptedKeyWithSecretKeyInvitelink(ikey, appKey.Key,
		appKey.KeyGeneration, nonce, label)
}

func GenerateSeitanInvitelinkAcceptanceKey(sikey []byte, uid keybase1.UID, eldestSeqno keybase1.Seqno, unixTimestampSeconds int64) (akey SeitanAKey, encoded string, err error) {
	type AKeyPayload struct {
		Stage       string         `codec:"stage" json:"stage"`
		UID         keybase1.UID   `codec:"uid" json:"uid"`
		EldestSeqno keybase1.Seqno `codec:"eldest_seqno" json:"eldest_seqno"`
		CTime       int64          `codec:"ctime" json:"ctime"`
		Version     SeitanVersion  `codec:"version" json:"version"`
	}

	akeyPayload, err := msgpack.Encode(AKeyPayload{
		Stage:       "accept",
		UID:         uid,
		EldestSeqno: eldestSeqno,
		CTime:       unixTimestampSeconds,
		Version:     SeitanVersionInvitelink,
	})
	if err != nil {
		return akey, encoded, err
	}
	return generateAcceptanceKey(akeyPayload, sikey)
}

// bound from SeitanEncodedIKeyInvitelinkLength
var invitelinkIKeyRxx = regexp.MustCompile(`/i/t/([a-z0-9]{16})#([a-z0-9+]{16,28})`)

func generateInvitelinkURLPrefix(mctx libkb.MetaContext) (string, error) {
	serverRoot, err := mctx.G().Env.GetServerURI()
	if err != nil {
		return "", err
	}
	// NOTE: if you change this url, change invitelinkIKeyRxx too!
	return fmt.Sprintf("%s/i/t/", serverRoot), nil
}

func GenerateInvitelinkURL(
	mctx libkb.MetaContext,
	ikey keybase1.SeitanIKeyInvitelink,
	id SCTeamInviteIDShort,
) (string, error) {
	prefix, err := generateInvitelinkURLPrefix(mctx)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%s#%s", prefix, id, ikey), nil
}
