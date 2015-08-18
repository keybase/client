package libkb

import (
	"crypto/sha256"
	"strings"
)

// PaperKeyPhrase is the string that can generate a paper key.  It
// is versioned and forced to be lowercase.  To make a new random
// phrase, use MakePaperKeyPhrase.  To convert a string to a
// PaperKeyPhrase, use NewPaperKeyPhrase.
type PaperKeyPhrase string

func MakePaperKeyPhrase(version uint8) (PaperKeyPhrase, error) {
	for i := 0; i < 1000; i++ {
		words, err := SecWordList(PaperKeyPhraseEntropy)
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

func NewPaperKeyPhrase(phrase string) PaperKeyPhrase {
	return PaperKeyPhrase(strings.ToLower(phrase))
}

func (p PaperKeyPhrase) String() string {
	return string(p)
}

func (p PaperKeyPhrase) Bytes() []byte {
	return []byte(p)
}

func (p PaperKeyPhrase) Version() uint8 {
	words := p.words()
	return wordVersion(words[len(words)-1])
}

// Prefix returns the first two words in the phrase.
func (p PaperKeyPhrase) Prefix() string {
	return strings.Join(p.words()[0:2], " ")
}

func (p PaperKeyPhrase) words() []string {
	return strings.Fields(p.String())
}

func wordVersion(word string) uint8 {
	h := sha256.Sum256([]byte(word))
	return h[len(h)-1] & 0x0f
}
