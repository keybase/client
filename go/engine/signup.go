package engine

import (
	"fmt"

	triplesec "github.com/keybase/go-triplesec"
	"github.com/keybase/client/go/libkb"
)

type SignupEngine struct {
	pwsalt     []byte
	tspkey     libkb.PassphraseStream
	uid        libkb.UID
	me         *libkb.User
	signingKey libkb.GenericKey
}

func NewSignupEngine() *SignupEngine {
	return &SignupEngine{}
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
		NewDetKeyEngine(nil, nil, nil),
		NewGPG(),
	}
}

func (s *SignupEngine) Init() error {
	return nil
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

type SignupEngineRunArg struct {
	Username   string
	Email      string
	InviteCode string
	Passphrase string
	DeviceName string
	SkipGPG    bool
	SkipMail   bool
}

// func (s *SignupEngine) Run(arg SignupEngineRunArg) error {
func (s *SignupEngine) Run(ctx *Context, args interface{}, reply interface{}) error {
	arg, ok := args.(SignupEngineRunArg)
	if !ok {
		return fmt.Errorf("invalid args type: %T", args)
	}
	if err := s.genTSPassKey(arg.Passphrase); err != nil {
		return err
	}

	if err := s.join(arg.Username, arg.Email, arg.InviteCode, arg.SkipMail); err != nil {
		return err
	}

	if err := s.registerDevice(ctx, arg.DeviceName); err != nil {
		return err
	}

	if err := s.genDetKeys(ctx); err != nil {
		return err
	}

	if arg.SkipGPG {
		return nil
	}

	if wantsGPG, err := s.checkGPG(ctx); err != nil {
		return err
	} else if wantsGPG {
		if err := s.addGPG(ctx); err != nil {
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
	eng := NewDetKeyEngine(s.me, s.signingKey, s.signingKey.GetKid())
	return RunEngine(eng, ctx, DetKeyArgs{Tsp: s.tspkey}, nil)
}

func (s *SignupEngine) checkGPG(ctx *Context) (bool, error) {
	eng := NewGPG()
	return eng.WantsGPG(ctx)
}

func (s *SignupEngine) addGPG(ctx *Context) error {
	fmt.Printf("SignupEngine.addGPG.  signingKey: %v\n", s.signingKey)
	eng := NewGPG()
	arg := GPGArg{Signer: s.signingKey}
	if err := RunEngine(eng, ctx, arg, nil); err != nil {
		return err
	}

	if s.signingKey == nil {
		s.signingKey = eng.LastKey()
	}
	return nil
}
