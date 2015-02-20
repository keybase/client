package engine

import (
	"github.com/keybase/go-triplesec"
	"github.com/keybase/go/libkb"
)

type SignupState struct {
	salt    []byte
	passkey libkb.TSPassKey
}

func NewSignupState() *SignupState {
	return &SignupState{}
}

func (s *SignupState) GenerateNewSalt() error {
	var err error
	s.salt, err = libkb.RandBytes(triplesec.SaltLen)
	if err != nil {
		return err
	}
	return nil
}

func (s *SignupState) TSPassKey(passphrase string) error {
	var err error
	s.passkey, err = libkb.NewTSPassKey(passphrase, s.salt)
	return err
}

func (s *SignupState) PWHash() []byte {
	return s.passkey.PWHash()
}

func (s *SignupState) Salt() []byte {
	return s.salt
}
