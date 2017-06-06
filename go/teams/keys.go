package teams

import (
	"encoding/base64"
	"encoding/binary"
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
	Boxes         map[string]string       `json:"boxes"`
}

type PerTeamSharedSecretBox struct {
	_struct         bool `codec:",toarray"`
	Version         uint
	PerUserKeySeqno keybase1.Seqno
	NonceCounter    uint32
	Ctext           []byte
}

type TeamKeyFactory struct {
	sharedSecret []byte
	generation   PerTeamSecretGeneration

	encryptionKey *libkb.NaclDHKeyPair
	signingKey    *libkb.NaclSigningKeyPair
}

func NewTeamKeyFactory() (*TeamKeyFactory, error) {
	sharedSecret, err := newSharedSecret()
	if err != nil {
		return nil, err
	}
	return NewTeamKeyFactoryWithSecret(sharedSecret, 1)
}

func NewTeamKeyFactoryWithSecret(secret []byte, generation PerTeamSecretGeneration) (*TeamKeyFactory, error) {
	if len(secret) != sharedSecretLen {
		return nil, errors.New("invalid shared secret length")
	}
	return &TeamKeyFactory{
		sharedSecret: secret,
		generation:   generation,
	}, nil
}

func (t *TeamKeyFactory) SharedSecret() []byte {
	return t.sharedSecret
}

func (t *TeamKeyFactory) SigningKey() (libkb.NaclSigningKeyPair, error) {
	if t.signingKey == nil {
		key, err := libkb.MakeNaclSigningKeyPairFromSecretBytes(derivedSecret(t.sharedSecret, libkb.TeamEdDSADerivationString))
		if err != nil {
			return libkb.NaclSigningKeyPair{}, err
		}
		t.signingKey = &key
	}
	return *t.signingKey, nil
}

func (t *TeamKeyFactory) EncryptionKey() (libkb.NaclDHKeyPair, error) {
	if t.encryptionKey == nil {
		key, err := libkb.MakeNaclDHKeyPairFromSecretBytes(derivedSecret(t.sharedSecret, libkb.TeamDHDerivationString))
		if err != nil {
			return libkb.NaclDHKeyPair{}, err
		}
		t.encryptionKey = &key
	}
	return *t.encryptionKey, nil

}

func (t *TeamKeyFactory) SharedSecretBoxes(senderKey libkb.GenericKey, recipients map[string]keybase1.PerUserKey) (*PerTeamSharedSecretBoxes, error) {

	// make the nonce prefix, skipping the zero counter
	// (0 used for previous key encryption nonce)
	n, err := newNonce24SkipZero()
	if err != nil {
		return nil, err
	}

	// make the recipient boxes with the new secret and the nonce prefix
	return t.sharedBoxes(t.sharedSecret, t.generation, n, senderKey, recipients)
}

func (t *TeamKeyFactory) RotateSharedSecretBoxes(senderKey libkb.GenericKey, recipients map[string]keybase1.PerUserKey) (*PerTeamSharedSecretBoxes, *SCPerTeamKey, error) {

	// make the nonce prefix
	nonce, err := newNonce24()
	if err != nil {
		return nil, nil, err
	}

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
	nonceBytes, _ := nonce.Nonce()
	sealed := secretbox.Seal(nil, t.sharedSecret, &nonceBytes, &keyb)

	// store it in PrevKey field
	prevKey := struct {
		_struct bool `codec:",toarray"`
		Version int
		Nonce   [24]byte
		Key     []byte
	}{
		Version: 1,
		Nonce:   nonceBytes,
		Key:     sealed,
	}
	packed, err := libkb.MsgpackEncode(prevKey)
	if err != nil {
		return nil, nil, err
	}
	encoded := base64.StdEncoding.EncodeToString(packed)

	// make the recipient boxes with the new secret and the nonce prefix
	t.sharedSecret = nextSecret
	t.generation = t.generation + 1
	t.signingKey = nil
	t.encryptionKey = nil
	boxes, err := t.sharedBoxes(t.sharedSecret, t.generation, nonce, senderKey, recipients)
	if err != nil {
		return nil, nil, err
	}

	// insert PrevKey
	boxes.PrevKey = &encoded

	// need a new PerTeamKey section since the key was rotated
	keySection, err := t.PerTeamKeySection()
	if err != nil {
		return nil, nil, err
	}

	return boxes, keySection, nil
}

func (t *TeamKeyFactory) sharedBoxes(secret []byte, generation PerTeamSecretGeneration, nonce *nonce24, senderKey libkb.GenericKey, recipients map[string]keybase1.PerUserKey) (*PerTeamSharedSecretBoxes, error) {
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

func (t *TeamKeyFactory) recipientBoxes(secret []byte, nonce *nonce24, senderKey libkb.NaclDHKeyPair, recipients map[string]keybase1.PerUserKey) (map[string]string, error) {
	boxes := make(map[string]string)
	for username, recipientPerUserKey := range recipients {
		boxStruct, err := t.recipientBox(secret, nonce, senderKey, recipientPerUserKey)
		if err != nil {
			return nil, err
		}

		encodedArray, err := libkb.MsgpackEncode(boxStruct)
		if err != nil {
			return nil, err
		}

		boxes[username] = base64.StdEncoding.EncodeToString(encodedArray)
	}

	return boxes, nil
}

func (t *TeamKeyFactory) recipientBox(secret []byte, nonce *nonce24, senderKey libkb.NaclDHKeyPair, recipient keybase1.PerUserKey) (*PerTeamSharedSecretBox, error) {
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

func (t *TeamKeyFactory) PerTeamKeySection() (*SCPerTeamKey, error) {
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

// XXX remove this
func boxTeamSharedSecret(secret []byte, senderKey libkb.GenericKey, recipients map[string]keybase1.PerUserKey) (*PerTeamSharedSecretBoxes, error) {
	senderNaclDHKey, ok := senderKey.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("got an unexpected key type for device encryption key: %T", senderKey)
	}
	noncePrefix, err := libkb.RandBytes(20)
	if err != nil {
		return nil, err
	}
	// The counter starts at 1, because 0 will be the prev secretbox, which is
	// omitted for the team root link, because this is the first shared key.
	var counter uint32 = 1
	boxes := make(map[string]string)
	for username, recipientPerUserKey := range recipients {
		recipientPerUserGenericKeypair, err := libkb.ImportKeypairFromKID(recipientPerUserKey.EncKID)
		if err != nil {
			return nil, err
		}
		recipientPerUserNaclKeypair, ok := recipientPerUserGenericKeypair.(libkb.NaclDHKeyPair)
		if !ok {
			return nil, fmt.Errorf("got an unexpected key type for recipient KID in sharedTeamKeyBox: %T", recipientPerUserGenericKeypair)
		}
		var nonce [24]byte
		counterBytes := [4]byte{}
		binary.BigEndian.PutUint32(counterBytes[:], counter)
		copy(nonce[:20], noncePrefix)
		copy(nonce[20:24], counterBytes[:])
		ctext := box.Seal(nil, secret, &nonce, ((*[32]byte)(&recipientPerUserNaclKeypair.Public)), ((*[32]byte)(senderNaclDHKey.Private)))
		boxStruct := PerTeamSharedSecretBox{
			Version:         libkb.SharedTeamKeyBoxVersion1,
			PerUserKeySeqno: recipientPerUserKey.Seqno,
			NonceCounter:    counter,
			Ctext:           ctext,
		}
		encodedArray, err := libkb.MsgpackEncode(boxStruct)
		if err != nil {
			return nil, err
		}
		base64Array := base64.StdEncoding.EncodeToString(encodedArray)
		boxes[username] = base64Array

		// increment nonce counter for next recipient
		counter++
	}

	return &PerTeamSharedSecretBoxes{
		Generation:    1,
		EncryptingKid: senderNaclDHKey.GetKID(),
		Nonce:         base64.StdEncoding.EncodeToString(noncePrefix),
		Boxes:         boxes,
	}, nil
}

// XXX remove this
func generatePerTeamKeys() (sharedSecret []byte, signingKey libkb.NaclSigningKeyPair, encryptionKey libkb.NaclDHKeyPair, err error) {
	// This is the magical secret key, from which we derive a DH keypair and a
	// signing keypair.
	sharedSecret, err = libkb.RandBytes(32)
	if err != nil {
		return
	}
	signingKey, encryptionKey, err = generatePerTeamKeysFromSecret(sharedSecret)
	return
}

// XXX remove this
func generatePerTeamKeysFromSecret(sharedSecret []byte) (signingKey libkb.NaclSigningKeyPair, encryptionKey libkb.NaclDHKeyPair, err error) {
	encryptionKey, err = libkb.MakeNaclDHKeyPairFromSecretBytes(derivedSecret(sharedSecret, libkb.TeamDHDerivationString))
	if err != nil {
		return
	}
	signingKey, err = libkb.MakeNaclSigningKeyPairFromSecretBytes(derivedSecret(sharedSecret, libkb.TeamEdDSADerivationString))
	if err != nil {
		return
	}
	return
}

const sharedSecretLen = 32

func newSharedSecret() ([]byte, error) {
	return libkb.RandBytes(sharedSecretLen)
}
