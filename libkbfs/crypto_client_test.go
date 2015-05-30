package libkbfs

import (
	"fmt"
	"testing"

	keybase1 "github.com/keybase/client/protocol/go"
)

type FakeCryptoClient struct {
	Local *CryptoLocal
}

func NewFakeCryptoClient(codec Codec, signingKey SigningKey) *FakeCryptoClient {
	return &FakeCryptoClient{
		Local: NewCryptoLocal(codec, signingKey),
	}
}

func (fc FakeCryptoClient) Call(s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.crypto.signED25519":
		arg := args.([]interface{})[0].(keybase1.SignED25519Arg)
		sigInfo, err := fc.Local.Sign(arg.Msg)
		if err != nil {
			return err
		}
		sigRes := res.(*keybase1.ED25519SignatureInfo)
		// Normally, we'd have to validate all the parameters
		// in sigInfo, but since this is used in tests only,
		// there's no need.
		var ed25519Signature keybase1.ED25519Signature
		copy(ed25519Signature[:], sigInfo.Signature)
		publicKey := sigInfo.VerifyingKey.KID.ToNaclSigningKeyPublic()
		*sigRes = keybase1.ED25519SignatureInfo{
			Sig:       ed25519Signature,
			PublicKey: keybase1.ED25519PublicKey(*publicKey),
		}
		return nil

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
}

// Test that signing a message and then verifying it works.
func TestCryptoClientSignAndVerify(t *testing.T) {
	signingKey := MakeFakeSigningKeyOrBust("client sign")
	codec := NewCodecMsgpack()
	fc := NewFakeCryptoClient(codec, signingKey)
	c := newCryptoClientWithClient(codec, nil, fc)

	msg := []byte("message")
	sigInfo, err := c.Sign(msg)
	if err != nil {
		t.Fatal(err)
	}

	err = c.Verify(msg, sigInfo)
	if err != nil {
		t.Error(err)
	}
}
