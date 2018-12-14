package keypair

import (
	"github.com/agl/ed25519"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/xdr"
)

// FromAddress represents a keypair to which only the address is know.  This KP
// can verify signatures, but cannot sign them.
//
// NOTE: ensure the address provided is a valid strkey encoded stellar address.
// Some operations will panic otherwise. It's recommended that you create these
// structs through the Parse() method.
type FromAddress struct {
	address string
}

func (kp *FromAddress) Address() string {
	return kp.address
}

func (kp *FromAddress) Hint() (r [4]byte) {
	copy(r[:], kp.publicKey()[28:])
	return
}

func (kp *FromAddress) Verify(input []byte, sig []byte) error {
	if len(sig) != 64 {
		return ErrInvalidSignature
	}

	var asig [64]byte
	copy(asig[:], sig[:])

	if !ed25519.Verify(kp.publicKey(), input, &asig) {
		return ErrInvalidSignature
	}
	return nil
}

func (kp *FromAddress) Sign(input []byte) ([]byte, error) {
	return nil, ErrCannotSign
}

func (kp *FromAddress) SignDecorated(input []byte) (xdr.DecoratedSignature, error) {
	return xdr.DecoratedSignature{}, ErrCannotSign
}

func (kp *FromAddress) publicKey() *[32]byte {
	bytes := strkey.MustDecode(strkey.VersionByteAccountID, kp.address)
	var result [32]byte

	copy(result[:], bytes)

	return &result
}
