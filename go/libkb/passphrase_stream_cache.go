// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"sync"
)

type PassphraseStreamCache struct {
	tsec             *LockedTriplesec
	passphraseStream *PassphraseStream
}

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
	return &LockedTriplesec{t: t}
}

var _ Triplesec = (*LockedTriplesec)(nil)

type PassphraseStreamCacheReader interface {
	Triplesec() Triplesec
	PassphraseStream() *PassphraseStream
	Valid() bool
}

func NewPassphraseStreamCache(tsec Triplesec, ps *PassphraseStream) *PassphraseStreamCache {
	return &PassphraseStreamCache{
		tsec:             NewLockedTriplesec(tsec),
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
