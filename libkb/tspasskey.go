package libkb

import (
	"fmt"

	triplesec "github.com/keybase/go-triplesec"
)

// TSPassKey is a deterministic set of keys generated from a user's passphrase
// and a salt using triplesec.
//
// It consists of a password hash, an EdDSA seed, a DH seed, and a local key
// storage client key.

const (
	pwhIndex   = 0
	pwhLen     = 32
	eddsaIndex = pwhIndex + pwhLen
	eddsaLen   = 32
	dhIndex    = eddsaIndex + eddsaLen
	dhLen      = 32
	lksIndex   = dhIndex + dhLen
	lksLen     = 32
	extraLen   = pwhLen + eddsaLen + dhLen + lksLen
)

type TSPassKey [extraLen]byte

func NewTSPassKey(passphrase string, salt []byte) (dk TSPassKey, err error) {
	tsec, err := triplesec.NewCipher([]byte(passphrase), salt)
	if err != nil {
		return dk, err
	}
	_, extra, err := tsec.DeriveKey(extraLen)
	if err != nil {
		return dk, err
	}
	if len(extra) != extraLen {
		return dk, fmt.Errorf("DeriveKey wrong number of bytes: %d", len(extra))
	}
	copy(dk[:], extra)
	return dk, nil
}

func (d TSPassKey) PWHash() []byte {
	return d[pwhIndex:eddsaIndex]
}

func (d TSPassKey) EdDSASeed() []byte {
	return d[eddsaIndex:dhIndex]
}

func (d TSPassKey) DHSeed() []byte {
	return d[dhIndex:lksIndex]
}

func (d TSPassKey) LksClientHalf() []byte {
	return d[lksIndex:]
}

func (d TSPassKey) String() string {
	return fmt.Sprintf("pwh:   %x\nEdDSA: %x\nDH:    %x\nlks:   %x", d.PWHash(), d.EdDSASeed(), d.DHSeed(), d.LksClientHalf())
	// return hex.EncodeToString(d[:])
}

func (d *TSPassKey) Scrub() {
	for i := 0; i < len(d); i++ {
		d[i] = 0
	}
}
