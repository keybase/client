package libkb

import (
	"fmt"
	"github.com/keybase/go-triplesec"
)

type SignupEngine struct {
	pwsalt     []byte
	tspkey     TSPassKey
	uid        UID
	me         *User
	signingKey GenericKey
	logui      LogUI
}

func NewSignupEngine(logui LogUI) *SignupEngine {
	return &SignupEngine{logui: logui}
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
	if res.Err != nil {
		return res
	}

	s.uid = *res.Uid
	user, err := LoadUser(LoadUserArg{Uid: res.Uid, PublicKeyOptional: true})
	if err != nil {
		return err
	}
	s.me = user
	return nil
}

func (s *SignupEngine) registerDevice(deviceName string) error {
	eng := NewDeviceEngine(s.me, s.logui)
	err := eng.Run(deviceName)
	if err != nil {
		return err
	}
	s.signingKey = eng.RootSigningKey()
	return nil
}

func (s *SignupEngine) genDetKeys() error {
	eng := NewDetKeyEngine(s.me, s.signingKey, s.logui)
	return eng.Run(s.tspkey.EdDSASeed(), s.tspkey.DHSeed())
}
