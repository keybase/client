package libkb

import (
	"fmt"
	"github.com/keybase/go-triplesec"
)

const (
	pwhIndex   = 0
	pwhLen     = 32
	eddsaIndex = pwhLen
	eddsaLen   = 32
	dhIndex    = eddsaIndex + eddsaLen
	dhLen      = 32
	lksIndex   = dhIndex + dhLen
	lksLen     = 32
	extraLen   = pwhLen + eddsaLen + dhLen + lksLen
)

type DetKey [extraLen]byte

func NewDetKey(passphrase string, salt []byte) (dk DetKey, err error) {
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

func (d DetKey) PWHash() []byte {
	return d[pwhIndex:eddsaIndex]
}

func (d DetKey) EddsaSecretKey() []byte {
	return d[eddsaIndex:dhIndex]
}

func (d DetKey) DhSecretKey() []byte {
	return d[dhIndex:lksIndex]
}

func (d DetKey) LksClientHalf() []byte {
	return d[lksIndex:]
}

func (d DetKey) String() string {
	return fmt.Sprintf("pwh:   %x\neddsa: %x\ndh:    %x\nlks:   %x", d.PWHash(), d.EddsaSecretKey(), d.DhSecretKey(), d.LksClientHalf())
	// return hex.EncodeToString(d[:])
}
