// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sync"
)

type PassphraseStreamCache struct {
	sync.Mutex
	tsec             *LockedTriplesec
	passphraseStream *PassphraseStream
}

// LockedTriplesec is a wrapper around a Triplesec interface,
// which allows multiple goroutines to handle the same underlying
// Triplesec at the same time. The mechanism is simply a mutex
// wrapping all accesses.
type LockedTriplesec struct {
	sync.Mutex
	t Triplesec
}

func (t *LockedTriplesec) DeriveKey(l int) ([]byte, []byte, error) {
	t.Lock()
	defer t.Unlock()
	return t.t.DeriveKey(l)
}

func (t *LockedTriplesec) Decrypt(b []byte) ([]byte, error) {
	t.Lock()
	defer t.Unlock()
	return t.t.Decrypt(b)
}

func (t *LockedTriplesec) Encrypt(b []byte) ([]byte, error) {
	t.Lock()
	defer t.Unlock()
	return t.t.Encrypt(b)
}

func (t *LockedTriplesec) Scrub() {
	t.Lock()
	defer t.Unlock()
	t.t.Scrub()
}

func NewLockedTriplesec(t Triplesec) *LockedTriplesec {
	if t == nil {
		return nil
	}
	return &LockedTriplesec{t: t}
}

var _ Triplesec = (*LockedTriplesec)(nil)

func NewPassphraseStreamCache(tsec Triplesec, ps *PassphraseStream) *PassphraseStreamCache {
	return &PassphraseStreamCache{
		tsec:             NewLockedTriplesec(tsec),
		passphraseStream: ps,
	}
}

func (s *PassphraseStreamCache) TriplesecAndGeneration() (Triplesec, PassphraseGeneration) {
	var zed PassphraseGeneration
	if s == nil {
		return nil, zed
	}
	s.Lock()
	defer s.Unlock()

	// Beware the classic Go `nil` interface bug...
	if s.tsec == nil {
		return nil, zed
	}
	if s.passphraseStream == nil {
		return nil, zed
	}
	ppgen := s.passphraseStream.Generation()
	if ppgen.IsNil() {
		return nil, zed
	}

	return s.tsec, ppgen
}

func (s *PassphraseStreamCache) PassphraseStreamAndTriplesec() (pps *PassphraseStream, tsec Triplesec) {

	if s == nil {
		return nil, nil
	}

	s.Lock()
	defer s.Unlock()

	// Beware the classic Go `nil` interface bug...
	if s.tsec != nil {
		tsec = s.tsec
	}

	if s.passphraseStream != nil {
		pps = s.passphraseStream.Clone()
	}

	return pps, tsec
}

// PassphraseStream returns a copy of the currently cached passphrase stream,
// or nil if none exists.
func (s *PassphraseStreamCache) PassphraseStream() *PassphraseStream {
	if s == nil {
		return nil
	}
	s.Lock()
	defer s.Unlock()
	return s.passphraseStream.Clone()
}

func (s *PassphraseStreamCache) MutatePassphraseStream(f func(*PassphraseStream)) bool {
	if s == nil {
		return false
	}
	s.Lock()
	defer s.Unlock()
	if s.passphraseStream == nil {
		return false
	}
	f(s.passphraseStream)
	return true
}

func (s *PassphraseStreamCache) Valid() bool {
	if s == nil {
		return false
	}
	s.Lock()
	defer s.Unlock()
	return s.passphraseStream != nil && s.tsec != nil
}

func (s *PassphraseStreamCache) ValidPassphraseStream() bool {
	if s == nil {
		return false
	}
	s.Lock()
	defer s.Unlock()
	return s.passphraseStream != nil
}

func (s *PassphraseStreamCache) ValidTsec() bool {
	if s == nil {
		return false
	}
	s.Lock()
	defer s.Unlock()
	return s.tsec != nil
}

func (s *PassphraseStreamCache) Clear() {
	if s == nil {
		return
	}
	s.Lock()
	defer s.Unlock()
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
	s.Lock()
	defer s.Unlock()
	fmt.Printf("PassphraseStreamCache:\n")
	fmt.Printf("Valid: %v\n", s.Valid())
	fmt.Printf("\n")
}
