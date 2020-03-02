package teams

import (
	"context"
	cryptorand "crypto/rand"
	"fmt"
	"strings"

	"github.com/keybase/client/go/msgpack"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

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

func (sikey SeitanSIKeyInvitelink) GenerateTeamInviteID() (id SCTeamInviteID, err error) {
	payload, err := msgpack.Encode(NewSeitanInviteIDPayload(SeitanVersionInvitelink))
	if err != nil {
		return id, err
	}
	return generateTeamInviteID(sikey[:], payload)
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
