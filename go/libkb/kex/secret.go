package kex

import (
	"crypto/hmac"
	"crypto/sha256"
	"strings"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/scrypt"
)

// Secret generates kex shared secrets.
type Secret struct {
	phrase   string
	secret   SecretKey
	strongID StrongID
	weakID   WeakID
}

// NewSecret creates a new random secret for a user.
func NewSecret(username string) (*Secret, error) {
	words, err := libkb.SecWordList(libkb.KEX_SESSION_ID_ENTROPY)
	if err != nil {
		return nil, err
	}
	phrase := strings.Join(words, " ")
	return SecretFromPhrase(username, phrase)
}

// SecretFromPhrase creates a secret for a user give a secret
// phrase.
func SecretFromPhrase(username, phrase string) (*Secret, error) {
	s := &Secret{}
	s.phrase = phrase
	if err := s.calculate(username); err != nil {
		return nil, err
	}
	return s, nil
}

// calculate runs scrypt on the phrase with the username as the
// salt.  The result of that is the secret.  It calculates the
// strong session ID by hmac-sha256'ing the secret.
func (s *Secret) calculate(username string) error {
	key, err := scrypt.Key([]byte(s.phrase), []byte(username),
		libkb.KEX_SCRYPT_COST, libkb.KEX_SCRYPT_R, libkb.KEX_SCRYPT_P, libkb.KEX_SCRYPT_KEYLEN)
	if err != nil {
		return err
	}

	mac := hmac.New(sha256.New, []byte("kex-session"))
	if _, err := mac.Write(key); err != nil {
		return err
	}

	copy(s.strongID[:], mac.Sum(nil))
	copy(s.secret[:], key)
	copy(s.weakID[:], s.strongID[0:16])

	return nil
}

// Secret returns the secret key.
func (s *Secret) Secret() SecretKey {
	return s.secret
}

// Phrase returns the random words that generate the secret.
func (s *Secret) Phrase() string {
	return s.phrase
}

// StrongID returns the strong session id.
func (s *Secret) StrongID() StrongID {
	return s.strongID
}

// StrongIDSlice returns StrongID as a byte slice for convenience.
func (s *Secret) StrongIDSlice() []byte {
	return s.strongID[:]
}

// WeakID returns the weak session id.
func (s *Secret) WeakID() WeakID {
	return s.weakID
}

// WeakIDSlice returns WeakID as a byte slice for convenience.
func (s *Secret) WeakIDSlice() []byte {
	return s.weakID[:]
}
