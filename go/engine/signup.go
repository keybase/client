package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	triplesec "github.com/keybase/go-triplesec"
)

type SignupEngine struct {
	pwsalt     []byte
	tspkey     libkb.PassphraseStream
	uid        libkb.UID
	me         *libkb.User
	signingKey libkb.GenericKey
	arg        *SignupEngineRunArg
}

type SignupEngineRunArg struct {
	Username   string
	Email      string
	InviteCode string
	Passphrase string
	DeviceName string
	SkipGPG    bool
	SkipMail   bool
}

func NewSignupEngine(arg *SignupEngineRunArg) *SignupEngine {
	return &SignupEngine{arg: arg}
}

func (s *SignupEngine) Name() string {
	return "Signup"
}

func (e *SignupEngine) RequiredUIs() []libkb.UIKind {
	return nil
}

func (e *SignupEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (e *SignupEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewDeviceEngine(nil),
		NewDetKeyEngine(nil),
		NewGPGImportKeyEngine(nil),
	}
}

func (s *SignupEngine) Init() error {
	return nil
}

func (s *SignupEngine) SetArg(arg *SignupEngineRunArg) {
	s.arg = arg
}

func (s *SignupEngine) CheckRegistered() (err error) {
	G.Log.Debug("+ libkb.SignupJoinEngine::CheckRegistered")
	if cr := G.Env.GetConfig(); cr == nil {
		err = fmt.Errorf("No configuration file available")
	} else if u := cr.GetUID(); u != nil {
		err = libkb.AlreadyRegisteredError{Uid: *u}
	}
	G.Log.Debug("- libkb.SignupJoinEngine::CheckRegistered -> %s", libkb.ErrToOk(err))
	return err
}

func (s *SignupEngine) PostInviteRequest(arg libkb.InviteRequestArg) error {
	return libkb.PostInviteRequest(arg)
}

func (s *SignupEngine) GetMe() *libkb.User {
	return s.me
}

func (s *SignupEngine) Run(ctx *Context, args interface{}, reply interface{}) error {
	if err := s.genTSPassKey(s.arg.Passphrase); err != nil {
		return err
	}

	if err := s.join(s.arg.Username, s.arg.Email, s.arg.InviteCode, s.arg.SkipMail); err != nil {
		return err
	}

	if err := s.registerDevice(ctx, s.arg.DeviceName); err != nil {
		return err
	}

	if err := s.genDetKeys(ctx); err != nil {
		return err
	}

	if s.arg.SkipGPG {
		return nil
	}

	if wantsGPG, err := s.checkGPG(ctx); err != nil {
		return err
	} else if wantsGPG {
		if err := s.addGPG(ctx, true); err != nil {
			return err
		}
	}

	return nil
}

func (s *SignupEngine) genTSPassKey(passphrase string) error {
	salt, err := libkb.RandBytes(triplesec.SaltLen)
	if err != nil {
		return err
	}
	s.pwsalt = salt
	_, s.tspkey, err = libkb.StretchPassphrase(passphrase, salt)
	return err
}

func (s *SignupEngine) join(username, email, inviteCode string, skipMail bool) error {
	joinEngine := NewSignupJoinEngine()

	arg := SignupJoinEngineRunArg{
		Username:   username,
		Email:      email,
		InviteCode: inviteCode,
		PWHash:     s.tspkey.PWHash(),
		PWSalt:     s.pwsalt,
		SkipMail:   skipMail,
	}
	res := joinEngine.Run(arg)
	if res.Err != nil {
		return res
	}

	s.uid = *res.Uid
	user, err := libkb.LoadUser(libkb.LoadUserArg{Uid: res.Uid, PublicKeyOptional: true})
	if err != nil {
		return err
	}
	s.me = user
	return nil
}

func (s *SignupEngine) registerDevice(ctx *Context, deviceName string) error {
	eng := NewDeviceEngine(s.me)

	args := DeviceEngineArgs{
		Name:          deviceName,
		LksClientHalf: s.tspkey.LksClientHalf(),
	}
	if err := RunEngine(eng, ctx, args, nil); err != nil {
		return err
	}

	// XXX get from reply instead?
	s.signingKey = eng.EldestKey()
	return nil
}

func (s *SignupEngine) genDetKeys(ctx *Context) error {
	arg := &DetKeyArgs{
		Tsp:         s.tspkey,
		Me:          s.me,
		SigningKey:  s.signingKey,
		EldestKeyID: s.signingKey.GetKid(),
	}
	eng := NewDetKeyEngine(arg)
	return RunEngine(eng, ctx, nil, nil)
}

func (s *SignupEngine) checkGPG(ctx *Context) (bool, error) {
	eng := NewGPGImportKeyEngine(nil)
	return eng.WantsGPG(ctx)
}

func (s *SignupEngine) addGPG(ctx *Context, allowMulti bool) error {
	G.Log.Debug("SignupEngine.addGPG.  signingKey: %v\n", s.signingKey)
	arg := GPGImportKeyArg{Signer: s.signingKey, AllowMulti: allowMulti, Me: s.me}
	eng := NewGPGImportKeyEngine(&arg)
	if err := RunEngine(eng, ctx, nil, nil); err != nil {
		return err
	}

	if s.signingKey == nil {
		s.signingKey = eng.LastKey()
	}
	return nil
}
