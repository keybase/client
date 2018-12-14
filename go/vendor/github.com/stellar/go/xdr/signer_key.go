package xdr

import (
	"fmt"

	"github.com/stellar/go/strkey"
	"github.com/stellar/go/support/errors"
)

// Address returns the strkey encoded form of this signer key.  This method will
// panic if the SignerKey is of an unknown type.
func (skey *SignerKey) Address() string {
	if skey == nil {
		return ""
	}

	vb := strkey.VersionByte(0)
	raw := make([]byte, 32)

	switch skey.Type {
	case SignerKeyTypeSignerKeyTypeEd25519:
		vb = strkey.VersionByteAccountID
		key := skey.MustEd25519()
		copy(raw, key[:])
	case SignerKeyTypeSignerKeyTypeHashX:
		vb = strkey.VersionByteHashX
		key := skey.MustHashX()
		copy(raw, key[:])
	case SignerKeyTypeSignerKeyTypePreAuthTx:
		vb = strkey.VersionByteHashTx
		key := skey.MustPreAuthTx()
		copy(raw, key[:])
	default:
		panic(fmt.Errorf("Unknown signer key type: %v", skey.Type))
	}

	return strkey.MustEncode(vb, raw)
}

// Equals returns true if `other` is equivalent to `skey`
func (skey *SignerKey) Equals(other SignerKey) bool {
	if skey.Type != other.Type {
		return false
	}

	switch skey.Type {
	case SignerKeyTypeSignerKeyTypeEd25519:
		l := skey.MustEd25519()
		r := other.MustEd25519()
		return l == r
	case SignerKeyTypeSignerKeyTypeHashX:
		l := skey.MustHashX()
		r := other.MustHashX()
		return l == r
	case SignerKeyTypeSignerKeyTypePreAuthTx:
		l := skey.MustPreAuthTx()
		r := other.MustPreAuthTx()
		return l == r
	default:
		panic(fmt.Errorf("Unknown signer key type: %v", skey.Type))
	}
}

// SetAddress modifies the receiver, setting it's value to the SignerKey form
// of the provided address.
func (skey *SignerKey) SetAddress(address string) error {
	if skey == nil {
		return nil
	}

	vb, err := strkey.Version(address)
	if err != nil {
		return errors.Wrap(err, "failed to extract address version")
	}

	var keytype SignerKeyType

	switch vb {
	case strkey.VersionByteAccountID:
		keytype = SignerKeyTypeSignerKeyTypeEd25519
	case strkey.VersionByteHashX:
		keytype = SignerKeyTypeSignerKeyTypeHashX
	case strkey.VersionByteHashTx:
		keytype = SignerKeyTypeSignerKeyTypePreAuthTx
	default:
		return errors.Errorf("invalid version byte: %v", vb)
	}

	raw, err := strkey.Decode(vb, address)
	if err != nil {
		return err
	}

	if len(raw) != 32 {
		return errors.New("invalid address")
	}

	var ui Uint256
	copy(ui[:], raw)

	*skey, err = NewSignerKey(keytype, ui)

	return err
}
