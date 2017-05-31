package teams

import (
	"encoding/base64"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// TeamBox comes from api server team/get endpoint.
type TeamBox struct {
	Nonce           string
	SenderKID       keybase1.KID `json:"sender_kid"`
	Generation      int
	Ctext           string
	PerUserKeySeqno keybase1.Seqno `json:"per_user_key_seqno"`
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

func (t *TeamBox) nonceBytes() ([]byte, error) {
	return base64.StdEncoding.DecodeString(t.Nonce)
}

func (t *TeamBox) ctextBytes() ([]byte, error) {
	return base64.StdEncoding.DecodeString(t.Ctext)
}
