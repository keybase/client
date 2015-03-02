package kex

import (
	"crypto/hmac"
	"crypto/sha256"
	"strings"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/scrypt"
)

type Secret struct {
	phrase   string
	secret   SecretKey
	strongID StrongID
}

func NewSecret(username string) (*Secret, error) {
	words, err := libkb.SecWordList(libkb.KEX_SESSION_ID_ENTROPY)
	if err != nil {
		return nil, err
	}
	phrase := strings.Join(words, " ")
	return SecretFromPhrase(username, phrase)
}

func SecretFromPhrase(username, phrase string) (*Secret, error) {
	s := &Secret{}
	s.phrase = phrase
	if err := s.calculate(username); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Secret) calculate(username string) error {
	key, err := scrypt.Key([]byte(s.phrase), []byte(username),
		libkb.KEX_SCRYPT_COST, libkb.KEX_SCRYPT_R, libkb.KEX_SCRYPT_P, libkb.KEX_SCRYPT_KEYLEN)
	if err != nil {
		return err
	}

	mac := hmac.New(sha256.New, []byte("kex-session"))
	mac.Write(key)
	copy(s.strongID[:], mac.Sum(nil))
	copy(s.secret[:], key)

	return nil
}

func (s *Secret) Secret() SecretKey {
	return s.secret
}

func (s *Secret) Phrase() string {
	return s.phrase
}

func (s *Secret) StrongID() StrongID {
	return s.strongID
}
