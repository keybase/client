package libkb

import (
	"fmt"
	"github.com/keybase/go-triplesec"
)

type SignupEngine struct {
	pwsalt []byte
	tspkey TSPassKey
	uid    UID
}

func NewSignupEngine() *SignupEngine {
	return &SignupEngine{}
}

func (s *SignupEngine) Init() error {
	return nil
}

func (s *SignupEngine) CheckRegistered() (err error) {
	G.Log.Debug("+ libkb.SignupJoinEngine::CheckRegistered")
	if cr := G.Env.GetConfig(); cr == nil {
		err = fmt.Errorf("No configuration file available")
	} else if u := cr.GetUid(); u != nil {
		err = AlreadyRegisteredError{*u}
	}
	G.Log.Debug("- libkb.SignupJoinEngine::CheckRegistered -> %s", ErrToOk(err))
	return err
}

func (s *SignupEngine) PostInviteRequest(arg InviteRequestArg) error {
	return PostInviteRequest(arg)
}

type SignupEngineRunArg struct {
	Username   string
	Email      string
	InviteCode string
	Passphrase string
	DeviceName string
}

// XXX this might need to return more than error...passphraseok, postok, writeok.
func (s *SignupEngine) Run(arg SignupEngineRunArg) error {
	if err := s.genTSPassKey(arg.Passphrase); err != nil {
		return err
	}

	if err := s.join(arg.Username, arg.Email, arg.InviteCode); err != nil {
		return err
	}

	if err := s.registerDevice(arg.DeviceName); err != nil {
		fmt.Printf("register device error: %s\n", err)
		return err
	}

	if err := s.genDetKeys(); err != nil {
		return err
	}

	return nil
}

func (s *SignupEngine) genTSPassKey(passphrase string) error {
	salt, err := RandBytes(triplesec.SaltLen)
	if err != nil {
		return err
	}
	s.pwsalt = salt

	s.tspkey, err = NewTSPassKey(passphrase, salt)
	return err
}

// XXX might have to do more with the joinEngine result...for now, just returning
// error.
func (s *SignupEngine) join(username, email, inviteCode string) error {
	joinEngine := NewSignupJoinEngine()

	arg := SignupJoinEngineRunArg{
		Username:   username,
		Email:      email,
		InviteCode: inviteCode,
		PWHash:     s.tspkey.PWHash(),
		PWSalt:     s.pwsalt,
	}
	res := joinEngine.Run(arg)
	if res.Error != nil {
		return res.Error
	}
	s.uid = *res.Uid
	return nil
}

func (s *SignupEngine) registerDevice(deviceName string) error {
	eng := NewDeviceEngine()
	return eng.Run(deviceName)
}

func (s *SignupEngine) genDetKeys() error {
	return nil
}
