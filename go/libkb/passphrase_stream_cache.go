package libkb

import (
	"fmt"

	triplesec "github.com/keybase/go-triplesec"
)

type PassphraseStreamCache struct {
	tsec             *triplesec.Cipher
	passphraseStream PassphraseStream
}

type PassphraseStreamCacheReader interface {
	Triplesec() *triplesec.Cipher
	PassphraseStream() PassphraseStream
	Valid() bool
}

func NewPassphraseStreamCache(tsec *triplesec.Cipher, ps PassphraseStream) *PassphraseStreamCache {
	return &PassphraseStreamCache{
		tsec:             tsec,
		passphraseStream: ps,
	}
}

func (s *PassphraseStreamCache) Triplesec() *triplesec.Cipher {
	if s == nil {
		return nil
	}
	return s.tsec
}

func (s *PassphraseStreamCache) PassphraseStream() PassphraseStream {
	if s == nil {
		return nil
	}
	return s.passphraseStream
}

func (s *PassphraseStreamCache) Valid() bool {
	if s == nil {
		return false
	}
	return s.tsec != nil && s.passphraseStream != nil
}

func (s *PassphraseStreamCache) Clear() {
	if s == nil {
		return
	}
	s.tsec.Scrub()
	s.tsec = nil
	s.passphraseStream = nil
}

func (s *PassphraseStreamCache) Dump() {
	fmt.Printf("PassphraseStreamCache:\n")
	if s == nil {
		fmt.Printf("nil\n")
		return
	}
	fmt.Printf("PassphraseStreamCache:\n")
	fmt.Printf("Valid: %v\n", s.Valid())
	fmt.Printf("\n")
}
