// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"errors"
	"strings"
)

// PaperKeyPhrase is the string that can generate a paper key.  It
// is versioned and forced to be lowercase.  To make a new random
// phrase, use MakePaperKeyPhrase.  To convert a string to a
// PaperKeyPhrase, use NewPaperKeyPhrase.
type PaperKeyPhrase string

// MakePaperKeyPhrase creates a new, random paper key phrase for
// the given version.
func MakePaperKeyPhrase(version uint8) (PaperKeyPhrase, error) {
	nbits := PaperKeySecretEntropy + PaperKeyIDBits + PaperKeyVersionBits
	for i := 0; i < 1000; i++ {
		words, err := SecWordList(nbits)
		if err != nil {
			return "", err
		}
		if wordVersion(words[len(words)-1]) != version {
			continue
		}
		return NewPaperKeyPhrase(strings.Join(words, " ")), nil
	}
	return "", KeyGenError{Msg: "exhausted attempts to generate valid paper key"}
}

// NewPaperKeyPhrase converts a string into a PaperKeyPhrase.
func NewPaperKeyPhrase(phrase string) PaperKeyPhrase {
	phrase = strings.TrimSpace(strings.ToLower(phrase))
	return PaperKeyPhrase(strings.Join(strings.Fields(phrase), " "))
}

// String returns a string representation of the phrase.
func (p PaperKeyPhrase) String() string {
	return string(p)
}

// Bytes returns a byte slice of the phrase.
func (p PaperKeyPhrase) Bytes() []byte {
	return []byte(p)
}

// Version calculates the phrase version.  0-15 are possible
// versions.
func (p PaperKeyPhrase) Version() (uint8, error) {
	words := p.words()
	if len(words) == 0 {
		return 0, errors.New("empty paper key phrase")
	}
	return wordVersion(words[len(words)-1]), nil
}

func (p PaperKeyPhrase) InvalidWords() (words []string) {
	for _, w := range p.words() {
		// in secwords.go:
		if !validWord(w) {
			words = append(words, w)
		}
	}
	return words
}

// Prefix returns the first two words in the phrase.
func (p PaperKeyPhrase) Prefix() string {
	return strings.Join(p.words()[0:2], " ")
}

// words returns the phrase as a slice of words.
func (p PaperKeyPhrase) words() []string {
	return strings.Fields(p.String())
}

func (p PaperKeyPhrase) NumWords() int {
	return len(p.words())
}

// wordVersion caclulates the paper key phrase version based on a
// word.
func wordVersion(word string) uint8 {
	h := sha256.Sum256([]byte(word))
	if PaperKeyVersionBits > 8 {
		panic("PaperKeyVersionBits must be 8 bits or fewer")
	}
	return h[len(h)-1] & ((1 << PaperKeyVersionBits) - 1)
}

func NewPaperKeyPhraseCheckVersion(g *GlobalContext, passphrase string) (ret PaperKeyPhrase, err error) {
	paperPhrase := NewPaperKeyPhrase(passphrase)
	version, err := paperPhrase.Version()
	if err != nil {
		return ret, err
	}
	if version != PaperKeyVersion {
		g.Log.Debug("paper version mismatch: generated paper key version = %d, libkb version = %d", version, PaperKeyVersion)
		return ret, KeyVersionError{}
	}
	return paperPhrase, nil
}
