package libkb

import (
	"sync"

	triplesec "github.com/keybase/go-triplesec"
)

type StreamCache struct {
	tsec             *triplesec.Cipher
	passphraseStream PassphraseStream
	sync.RWMutex
}

func NewStreamCache(tsec *triplesec.Cipher, ps PassphraseStream) *StreamCache {
	return &StreamCache{
		tsec:             tsec,
		passphraseStream: ps,
	}
}

func (s *StreamCache) Triplesec() *triplesec.Cipher {
	if s == nil {
		return nil
	}
	s.RLock()
	defer s.RUnlock()
	return s.tsec
}

func (s *StreamCache) PassphraseStream() PassphraseStream {
	if s == nil {
		return nil
	}
	s.RLock()
	defer s.RUnlock()
	return s.passphraseStream
}

func (s *StreamCache) Valid() bool {
	if s == nil {
		return false
	}
	s.RLock()
	defer s.RUnlock()
	return s.tsec != nil && s.passphraseStream != nil
}

func (s *StreamCache) Clear() {
	if s == nil {
		return
	}
	s.Lock()
	defer s.Unlock()
	s.tsec.Scrub()
	s.tsec = nil
	s.passphraseStream = nil
}
