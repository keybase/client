package libkb

import (
	"fmt"

	triplesec "github.com/keybase/go-triplesec"
)

func StretchPassphrase(passphrase string, salt []byte) (tsec *triplesec.Cipher, pps *PassphraseStream, err error) {
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
	pps = NewPassphraseStream(tmp)
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

type PassphraseStream struct {
	stream []byte
	gen    PassphraseGeneration
}

func NewPassphraseStream(s []byte) *PassphraseStream {
	return &PassphraseStream{
		stream: s,
		gen:    PassphraseGeneration(-1),
	}
}

func (ps *PassphraseStream) SetGeneration(gen PassphraseGeneration) {
	ps.gen = gen
}

func (ps PassphraseStream) PWHash() []byte {
	return d.stream[pwhIndex:eddsaIndex]
}

func (ps PassphraseStream) EdDSASeed() []byte {
	return d.stream[eddsaIndex:dhIndex]
}

func (ps PassphraseStream) DHSeed() []byte {
	return d.stream[dhIndex:lksIndex]
}

func (ps PassphraseStream) LksClientHalf() []byte {
	return d.stream[lksIndex:]
}

func (ps PassphraseStream) String() string {
	return fmt.Sprintf("pwh:   %x\nEdDSA: %x\nDH:    %x\nlks:   %x", d.PWHash(), d.EdDSASeed(), d.DHSeed(), d.LksClientHalf())
}
