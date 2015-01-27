package libkb

import (
	"crypto/rand"
	"github.com/keybase/go-triplesec"
)

type SignupState struct {
	salt   []byte
	detkey DetKey
}

func NewSignupState() *SignupState {
	return &SignupState{}
}

func (s *SignupState) GenerateNewSalt() error {
	buf := make([]byte, triplesec.SaltLen)
	if _, err := rand.Read(buf); err != nil {
		return err
	}
	s.salt = buf
	return nil
}

func (s *SignupState) DetKey(passphrase string) error {
	var err error
	s.detkey, err = NewDetKey(passphrase, s.salt)
	return err
}

func (s *SignupState) PWHash() []byte {
	return s.detkey.PWHash()
}

func (s *SignupState) Salt() []byte {
	return s.salt
}
