package teams

import (
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/box"
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

	// make the nonce prefix
	n, err := newNonce24()
	if err != nil {
		return nil, err
	}
	// increment past the zero-counter since not rotating keys
	// (0 used for previous key encryption nonce)
	n.Inc()

	// make the recipient boxes with the new secret and the nonce prefix
	return t.sharedBoxes(t.sharedSecret, t.generation, n, senderKey, recipients)
}

func (t *TeamKeyFactory) RotateSharedSecretBoxes(senderKey libkb.GenericKey, recipients map[string]keybase1.PerUserKey) (*PerTeamSharedSecretBoxes, error) {

	// make the nonce prefix
	n, err := newNonce24()
	if err != nil {
		return nil, err
	}
	_ = n

	// make a new secret

	// derive new key from new secret for PrevKey

	// encrypt existing secret with derived key and nonce counter 0

	// store it in PrevKey field

	// make the recipient boxes with the new secret and the nonce prefix

	return nil, nil
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

		// increment nonce counter for next recipient
		nonce.Inc()
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

	nonceBytes := nonce.Nonce()
	ctext := box.Seal(nil, secret, &nonceBytes, ((*[32]byte)(&recipientPerUserNaclKeypair.Public)), ((*[32]byte)(senderKey.Private)))

	boxStruct := PerTeamSharedSecretBox{
		Version:         libkb.SharedTeamKeyBoxVersion1,
		PerUserKeySeqno: recipient.Seqno,
		NonceCounter:    nonce.Counter(),
		Ctext:           ctext,
	}

	return &boxStruct, nil
}

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
