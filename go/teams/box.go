package teams

import (
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// TeamBox comes from api server team/get endpoint.
type TeamBox struct {
	Nonce           string
	SenderKID       keybase1.KID `json:"sender_kid"`
	Generation      int
	Ctext           string
	PerUserKeySeqno keybase1.Seqno  `json:"per_user_key_seqno"`
	ReaderKeyMasks  []ReaderKeyMask `json:"reader_key_masks"`
}

type ReaderKeyMask struct {
	Application int
	Generation  int
	Mask        string
}

func (r ReaderKeyMask) MaskBytes() ([]byte, error) {
	return base64.StdEncoding.DecodeString(r.Mask)
}

// Open decrypts Ctext using encKey.
func (t *TeamBox) Open(encKey *libkb.NaclDHKeyPair) ([]byte, error) {
	nonce, err := t.nonceBytes()
	if err != nil {
		return nil, err
	}
	ctext, err := t.ctextBytes()
	if err != nil {
		return nil, err
	}
	nei := &libkb.NaclEncryptionInfo{
		Ciphertext:     ctext,
		EncryptionType: libkb.KIDNaclDH,
		Nonce:          nonce,
		Receiver:       encKey.GetKID().ToBytes(),
		Sender:         t.SenderKID.ToBytes(),
	}

	plaintext, _, err := encKey.Decrypt(nei)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// ApplicationKey returns the most recent key for an application.
func (t *TeamBox) ApplicationKey(application keybase1.TeamApplication, secret []byte) (keybase1.TeamApplicationKey, error) {
	var max ReaderKeyMask
	for _, rkm := range t.ReaderKeyMasks {
		if keybase1.TeamApplication(rkm.Application) != application {
			continue
		}
		if rkm.Generation < max.Generation {
			continue
		}
		max = rkm
	}

	if max.Application == 0 {
		return keybase1.TeamApplicationKey{}, libkb.NotFoundError{Msg: fmt.Sprintf("no mask found for application %d", application)}
	}

	return t.applicationKeyForMask(max, secret)
}

func (t *TeamBox) ApplicationKeyAtGeneration(application keybase1.TeamApplication, generation int, secret []byte) (keybase1.TeamApplicationKey, error) {
	for _, rkm := range t.ReaderKeyMasks {
		if keybase1.TeamApplication(rkm.Application) != application {
			continue
		}
		if rkm.Generation != generation {
			continue
		}
		return t.applicationKeyForMask(rkm, secret)
	}

	return keybase1.TeamApplicationKey{}, libkb.NotFoundError{Msg: fmt.Sprintf("no mask found for application %d, generation %d", application, generation)}
}

func (t *TeamBox) applicationKeyForMask(mask ReaderKeyMask, secret []byte) (keybase1.TeamApplicationKey, error) {
	var derivationString string
	switch keybase1.TeamApplication(mask.Application) {
	case keybase1.TeamApplication_KBFS:
		derivationString = libkb.TeamKBFSDerivationString
	case keybase1.TeamApplication_CHAT:
		derivationString = libkb.TeamChatDerivationString
	case keybase1.TeamApplication_SALTPACK:
		derivationString = libkb.TeamSaltpackDerivationString
	default:
		return keybase1.TeamApplicationKey{}, errors.New("invalid application id")
	}

	key := keybase1.TeamApplicationKey{
		Application: keybase1.TeamApplication(mask.Application),
		Generation:  mask.Generation,
	}

	maskBytes, err := mask.MaskBytes()
	if err != nil {
		return key, err
	}
	var secBytes []byte
	n := libkb.XORBytes(secBytes, derivedSecret(secret, derivationString), maskBytes)
	if n != 32 {
		return key, errors.New("invalid derived secret xor mask size")
	}
	copy(key.Key[:], secBytes)

	return key, nil
}

func (t *TeamBox) nonceBytes() ([]byte, error) {
	return base64.StdEncoding.DecodeString(t.Nonce)
}

func (t *TeamBox) ctextBytes() ([]byte, error) {
	return base64.StdEncoding.DecodeString(t.Ctext)
}
