// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
)

type PassphraseStreamCache struct {
	tsec             Triplesec
	passphraseStream *PassphraseStream
}

type PassphraseStreamCacheReader interface {
	Triplesec() Triplesec
	PassphraseStream() *PassphraseStream
	Valid() bool
}

func NewPassphraseStreamCache(tsec Triplesec, ps *PassphraseStream) *PassphraseStreamCache {
	return &PassphraseStreamCache{
		tsec:             tsec,
		passphraseStream: ps,
	}
}

func (s *PassphraseStreamCache) Triplesec() Triplesec {
	if s == nil {
		return nil
	}
	return s.tsec
}

// PassphraseStream returns a copy of the currently cached passphrase stream,
// or nil if none exists.
func (s *PassphraseStreamCache) PassphraseStream() *PassphraseStream {
	if s == nil {
		return nil
	}
	return s.passphraseStream.Clone()
}

// PassphraseStream returns a reference to the currently cached passphrase stream,
// or nil if none exists.
func (s *PassphraseStreamCache) PassphraseStreamRef() *PassphraseStream {
	if s == nil {
		return nil
	}
	return s.passphraseStream
}

func (s *PassphraseStreamCache) Valid() bool {
	return s.ValidPassphraseStream() && s.ValidTsec()
}

func (s *PassphraseStreamCache) ValidPassphraseStream() bool {
	if s == nil {
		return false
	}
	return s.passphraseStream != nil
}

func (s *PassphraseStreamCache) ValidTsec() bool {
	if s == nil {
		return false
	}
	return s.tsec != nil
}

func (s *PassphraseStreamCache) Clear() {
	if s == nil {
		return
	}
	if s.tsec != nil {
		s.tsec.Scrub()
		s.tsec = nil
	}
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
