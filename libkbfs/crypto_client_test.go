package libkbfs

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"testing"
)

type FakeCryptoClient struct {
	Local *CryptoLocal
}

func NewFakeCryptoClient(key Key) *FakeCryptoClient {
	return &FakeCryptoClient{
		Local: NewCryptoLocal(key),
	}
}

func (fc FakeCryptoClient) Call(s string, args interface{}, res interface{}) error {
	switch s {
	case "keybase.1.crypto.sign":
		arg := args.([]interface{})[0].(keybase1.SignArg)
		sig, verifyingKeyKid, err := fc.Local.Sign(arg.Msg)
		if err != nil {
			return err
		}
		sigRes := res.(*keybase1.SignatureInfo)
		*sigRes = keybase1.SignatureInfo{
			Sig:             sig,
			VerifyingKeyKid: libkb.KID(verifyingKeyKid).String(),
		}
		return nil

	default:
		return fmt.Errorf("Unknown call: %s %v %v", s, args, res)
	}
	return nil
}

// Test that signing a message and verifying it works.
func TestCryptoClientSignAndVerify(t *testing.T) {
	signingKey := NewFakeSigningKeyOrBust("client sign")
	fc := NewFakeCryptoClient(signingKey)
	c := newCryptoClientWithClient(nil, fc)

	msg := []byte("message")
	sig, verifyingKeyKid, err := c.Sign(msg)
	if err != nil {
		t.Fatal(err)
	}

	verifyingKey, err := libkb.ImportKeypairFromKID(libkb.KID(verifyingKeyKid), nil)
	if err != nil {
		t.Fatal(err)
	}

	if err := c.Verify(sig, msg, verifyingKey); err != nil {
		t.Error(err)
	}
}

// Test that crypto.Verify() rejects various types of bad signatures.
func TestCryptoClientVerifyFailures(t *testing.T) {
	signingKey := NewFakeSigningKeyOrBust("client sign")
	fc := NewFakeCryptoClient(signingKey)
	c := newCryptoClientWithClient(nil, fc)

	msg := []byte("message")
	sig, verifyingKeyKid, err := c.Sign(msg)
	if err != nil {
		t.Fatal(err)
	}

	verifyingKey, err := libkb.ImportKeypairFromKID(libkb.KID(verifyingKeyKid), nil)

	// Corrupt signature.

	if err := c.Verify(append(sig, []byte("corruption")...), msg, verifyingKey); err == nil {
		t.Error("Verifying corrupt sig unexpectedly passed")
	}

	// Corrupt message.

	if err := c.Verify(sig, append(msg, []byte("corruption")...), verifyingKey); err == nil {
		t.Error("Verifying sig for corrupt message unexpectedly passed")
	}

	// Signature with different key.

	key := NewFakeVerifyingKeyOrBust("fake key")
	if err := c.Verify(sig, msg, key); err == nil {
		t.Error("Verifying with wrong key unexpectedly passed")
	}
}
