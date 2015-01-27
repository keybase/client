package libkb

import (
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
	var err error
	s.salt, err = RandBytes(triplesec.SaltLen)
	if err != nil {
		return err
	}
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
