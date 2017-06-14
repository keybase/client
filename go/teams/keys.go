package teams

import (
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/nacl/secretbox"
)

type PerTeamSecretGeneration int

type PerTeamSharedSecretBoxes struct {
	Generation    PerTeamSecretGeneration `json:"generation"`
	EncryptingKid keybase1.KID            `json:"encrypting_kid"`
	Nonce         string                  `json:"nonce"`
	PrevKey       *string                 `json:"prev"`
	Boxes         map[keybase1.UID]string `json:"boxes"`
}

type PerTeamSharedSecretBox struct {
	_struct         bool `codec:",toarray"`
	Version         uint
	PerUserKeySeqno keybase1.Seqno
	NonceCounter    uint32
	Ctext           []byte
}

type TeamKeyManager struct {
	libkb.Contextified

	sharedSecret []byte
	generation   PerTeamSecretGeneration

	encryptionKey *libkb.NaclDHKeyPair
	signingKey    *libkb.NaclSigningKeyPair
}

func NewTeamKeyManager(g *libkb.GlobalContext) (*TeamKeyManager, error) {
	sharedSecret, err := newSharedSecret()
	if err != nil {
		return nil, err
	}
	return NewTeamKeyManagerWithSecret(g, sharedSecret, 1)
}

func NewTeamKeyManagerWithSecret(g *libkb.GlobalContext, secret []byte, generation PerTeamSecretGeneration) (*TeamKeyManager, error) {
	if len(secret) != sharedSecretLen {
		return nil, errors.New("invalid shared secret length")
	}
	return &TeamKeyManager{
		Contextified: libkb.NewContextified(g),
		sharedSecret: secret,
		generation:   generation,
	}, nil
}

// SharedSecret returns the team's shared secret.
func (t *TeamKeyManager) SharedSecret() []byte {
	return t.sharedSecret
}

// EncryptionKey returns the derived NaclSigningKeyPair from the team's shared secret.
func (t *TeamKeyManager) SigningKey() (libkb.NaclSigningKeyPair, error) {
	if t.signingKey == nil {
		key, err := libkb.MakeNaclSigningKeyPairFromSecretBytes(derivedSecret(t.sharedSecret, libkb.TeamEdDSADerivationString))
		if err != nil {
			return libkb.NaclSigningKeyPair{}, err
		}
		t.signingKey = &key
	}
	return *t.signingKey, nil
}

// EncryptionKey returns the derived NaclDHKeyPair from the team's shared secret.
func (t *TeamKeyManager) EncryptionKey() (libkb.NaclDHKeyPair, error) {
	if t.encryptionKey == nil {
		key, err := libkb.MakeNaclDHKeyPairFromSecretBytes(derivedSecret(t.sharedSecret, libkb.TeamDHDerivationString))
		if err != nil {
			return libkb.NaclDHKeyPair{}, err
		}
		t.encryptionKey = &key
	}
	return *t.encryptionKey, nil
}

// SharedSecretBoxes creates the PerTeamSharedSecretBoxes for recipients with the
// existing team shared secret.
func (t *TeamKeyManager) SharedSecretBoxes(senderKey libkb.GenericKey, recipients map[keybase1.UID]keybase1.PerUserKey) (boxes *PerTeamSharedSecretBoxes, err error) {
	defer t.G().Trace("SharedSecretBoxes", func() error { return err })()

	// make the nonce prefix, skipping the zero counter
	// (0 used for previous key encryption nonce)
	n, err := newNonce24SkipZero()
	if err != nil {
		return nil, err
	}

	// make the recipient boxes with the new secret and the nonce prefix
	return t.sharedBoxes(t.sharedSecret, t.generation, n, senderKey, recipients)
}

// RotateSharedSecretBoxes creates a new shared secret for the team and the
// required PerTeamKey section.
func (t *TeamKeyManager) RotateSharedSecretBoxes(senderKey libkb.GenericKey, recipients map[keybase1.UID]keybase1.PerUserKey) (boxes *PerTeamSharedSecretBoxes, keySection *SCPerTeamKey, err error) {
	defer t.G().Trace("RotateSharedSecretBoxes", func() error { return err })()

	// make a new secret
	nextSecret, err := newSharedSecret()
	if err != nil {
		return nil, nil, err
	}

	// derive new key from new secret for PrevKey
	key := derivedSecret(nextSecret, libkb.TeamPrevKeySecretBoxDerivationString)
	var keyb [32]byte
	copy(keyb[:], key)

	// encrypt existing secret with derived key and nonce counter 0
	nonce, err := newNonce24()
	if err != nil {
		return nil, nil, err
	}
	nonceBytes, counter := nonce.Nonce()
	if counter != 0 {
		// this should never happen, but might as well make sure it is zero
		return nil, nil, errors.New("nonce counter not 0 for first use")
	}
	sealed := secretbox.Seal(nil, t.sharedSecret, &nonceBytes, &keyb)

	// encode encrypted prev key
	prevKeyEncoded, err := t.prevKeyEncoded(nonceBytes, sealed)
	if err != nil {
		return nil, nil, err
	}

	// make the recipient boxes with the new secret and the incrementing nonce24
	t.setNextSharedSecret(nextSecret)
	boxes, err = t.sharedBoxes(t.sharedSecret, t.generation, nonce, senderKey, recipients)
	if err != nil {
		return nil, nil, err
	}

	// insert encoded encrypted PrevKey
	boxes.PrevKey = &prevKeyEncoded

	// need a new PerTeamKey section since the key was rotated
	keySection, err = t.perTeamKeySection()
	if err != nil {
		return nil, nil, err
	}

	return boxes, keySection, nil
}

func (t *TeamKeyManager) sharedBoxes(secret []byte, generation PerTeamSecretGeneration, nonce *nonce24, senderKey libkb.GenericKey, recipients map[keybase1.UID]keybase1.PerUserKey) (*PerTeamSharedSecretBoxes, error) {
	senderNaclDHKey, ok := senderKey.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("got an unexpected key type for device encryption key: %T", senderKey)
	}

	boxes, err := t.recipientBoxes(secret, nonce, senderNaclDHKey, recipients)
	if err != nil {
		return nil, err
	}

	return &PerTeamSharedSecretBoxes{
		Generation:    generation,
		EncryptingKid: senderNaclDHKey.GetKID(),
		Nonce:         nonce.PrefixEncoded(),
		Boxes:         boxes,
	}, nil
}

func (t *TeamKeyManager) recipientBoxes(secret []byte, nonce *nonce24, senderKey libkb.NaclDHKeyPair, recipients map[keybase1.UID]keybase1.PerUserKey) (map[keybase1.UID]string, error) {
	boxes := make(map[keybase1.UID]string)
	for uid, recipientPerUserKey := range recipients {
		boxStruct, err := t.recipientBox(secret, nonce, senderKey, recipientPerUserKey)
		if err != nil {
			return nil, err
		}

		encodedArray, err := libkb.MsgpackEncode(boxStruct)
		if err != nil {
			return nil, err
		}

		boxes[uid] = base64.StdEncoding.EncodeToString(encodedArray)
	}

	return boxes, nil
}

func (t *TeamKeyManager) recipientBox(secret []byte, nonce *nonce24, senderKey libkb.NaclDHKeyPair, recipient keybase1.PerUserKey) (*PerTeamSharedSecretBox, error) {
	recipientPerUserGenericKeypair, err := libkb.ImportKeypairFromKID(recipient.EncKID)
	if err != nil {
		return nil, err
	}
	recipientPerUserNaclKeypair, ok := recipientPerUserGenericKeypair.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("got an unexpected key type for recipient KID in sharedTeamKeyBox: %T", recipientPerUserGenericKeypair)
	}

	nonceBytes, nonceCounter := nonce.Nonce()
	ctext := box.Seal(nil, secret, &nonceBytes, ((*[32]byte)(&recipientPerUserNaclKeypair.Public)), ((*[32]byte)(senderKey.Private)))

	boxStruct := PerTeamSharedSecretBox{
		Version:         libkb.SharedTeamKeyBoxVersion1,
		PerUserKeySeqno: recipient.Seqno,
		NonceCounter:    nonceCounter,
		Ctext:           ctext,
	}

	return &boxStruct, nil
}

func (t *TeamKeyManager) perTeamKeySection() (*SCPerTeamKey, error) {
	sigKey, err := t.SigningKey()
	if err != nil {
		return nil, err
	}
	encKey, err := t.EncryptionKey()
	if err != nil {
		return nil, err
	}
	return &SCPerTeamKey{
		Generation: int(t.generation),
		SigKID:     sigKey.GetKID(),
		EncKID:     encKey.GetKID(),
	}, nil
}

func (t *TeamKeyManager) setNextSharedSecret(secret []byte) {
	t.sharedSecret = secret

	// bump generation number
	t.generation = t.generation + 1

	// clear out derived keys
	t.signingKey = nil
	t.encryptionKey = nil

	t.G().Log.Debug("TeamKeyManager: set next shared secret, generation %d", t.generation)
}

func (t *TeamKeyManager) prevKeyEncoded(nonceBytes [24]byte, key []byte) (string, error) {
	prevKey := struct {
		_struct bool `codec:",toarray"`
		Version int
		Nonce   [24]byte
		Key     []byte
	}{
		Version: 1,
		Nonce:   nonceBytes,
		Key:     key,
	}
	packed, err := libkb.MsgpackEncode(prevKey)
	if err != nil {
		return "", err
	}
	encoded := base64.StdEncoding.EncodeToString(packed)
	return encoded, nil
}

const sharedSecretLen = 32

func newSharedSecret() ([]byte, error) {
	return libkb.RandBytes(sharedSecretLen)
}
