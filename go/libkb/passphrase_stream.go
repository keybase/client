package libkb

import (
	"fmt"

	triplesec "github.com/keybase/go-triplesec"
)

func StretchPassphrase(passphrase string, salt []byte) (tsec *triplesec.Cipher, pps PassphraseStream, err error) {
	if salt == nil {
		err = fmt.Errorf("no salt provided to StretchPassphrase")
		return
	}
	var tmp []byte
	if tsec, err = triplesec.NewCipher([]byte(passphrase), salt); err != nil {
		return
	}
	if _, tmp, err = tsec.DeriveKey(extraLen); err != nil {
		return
	}
	pps = PassphraseStream(tmp)
	return
}

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

type PassphraseStream []byte

func (d PassphraseStream) PWHash() []byte {
	return d[pwhIndex:eddsaIndex]
}

func (d PassphraseStream) EdDSASeed() []byte {
	return d[eddsaIndex:dhIndex]
}

func (d PassphraseStream) DHSeed() []byte {
	return d[dhIndex:lksIndex]
}

func (d PassphraseStream) LksClientHalf() []byte {
	return d[lksIndex:]
}

func (d PassphraseStream) String() string {
	return fmt.Sprintf("pwh:   %x\nEdDSA: %x\nDH:    %x\nlks:   %x", d.PWHash(), d.EdDSASeed(), d.DHSeed(), d.LksClientHalf())
}
