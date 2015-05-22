package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	triplesec "github.com/keybase/go-triplesec"
)

type SignupEngine struct {
	pwsalt     []byte
	tspkey     libkb.PassphraseStream
	uid        keybase1.UID
	me         *libkb.User
	signingKey libkb.GenericKey
	arg        *SignupEngineRunArg
	lks        *libkb.LKSec
	libkb.Contextified
}

type SignupEngineRunArg struct {
	Username     string
	Email        string
	InviteCode   string
	Passphrase   string
	SecretStorer libkb.SecretStorer
	DeviceName   string
	SkipGPG      bool
	SkipMail     bool
}

func NewSignupEngine(arg *SignupEngineRunArg, g *libkb.GlobalContext) *SignupEngine {
	return &SignupEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (s *SignupEngine) Name() string {
	return "Signup"
}

func (s *SignupEngine) RequiredUIs() []libkb.UIKind {
	return nil
}

func (s *SignupEngine) Prereqs() Prereqs { return Prereqs{} }

func (s *SignupEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DetKeyEngine{},
		&GPGImportKeyEngine{},
		&DeviceWrap{},
	}
}

func (s *SignupEngine) Init() error {
	return nil
}

func (s *SignupEngine) SetArg(arg *SignupEngineRunArg) {
	s.arg = arg
}

func (s *SignupEngine) CheckRegistered() (err error) {
	s.G().Log.Debug("+ SignupEngine::CheckRegistered")
	if cr := s.G().Env.GetConfig(); cr == nil {
		err = fmt.Errorf("No configuration file available")
	} else if u := cr.GetUID(); u.Exists() {
		err = libkb.AlreadyRegisteredError{UID: u}
	}
	s.G().Log.Debug("- SignupEngine::CheckRegistered -> %s", libkb.ErrToOk(err))
	return err
}

func (s *SignupEngine) PostInviteRequest(arg libkb.InviteRequestArg) error {
	return libkb.PostInviteRequest(arg)
}

func (s *SignupEngine) GetMe() *libkb.User {
	return s.me
}

func (s *SignupEngine) Run(ctx *Context) error {
	// make sure we're starting with a clear login state:
	if err := s.G().Logout(); err != nil {
		return err
	}

	f := func(a libkb.LoginContext) error {
		if err := s.genTSPassKey(a, s.arg.Passphrase); err != nil {
			return err
		}

		if err := s.join(a, s.arg.Username, s.arg.Email, s.arg.InviteCode, s.arg.SkipMail); err != nil {
			return err
		}

		if err := s.registerDevice(a, ctx, s.arg.DeviceName); err != nil {
			return err
		}

		if err := s.genDetKeys(ctx); err != nil {
			return fmt.Errorf("detkeys error: %s", err)
		}

		if s.arg.SkipGPG {
			return nil
		}

		if wantsGPG, err := s.checkGPG(ctx); err != nil {
			return err
		} else if wantsGPG {
			if err := s.addGPG(a, ctx, true); err != nil {
				return fmt.Errorf("addGPG error: %s", err)
			}
		}

		return nil
	}
	return s.G().LoginState().ExternalFunc(f, "SignupEngine - Run")
}

func (s *SignupEngine) genTSPassKey(a libkb.LoginContext, passphrase string) error {
	salt, err := libkb.RandBytes(triplesec.SaltLen)
	if err != nil {
		return err
	}
	s.pwsalt = salt
	var tsec *triplesec.Cipher
	tsec, s.tspkey, err = libkb.StretchPassphrase(passphrase, salt)
	if err != nil {
		return err
	}
	a.CreateStreamCache(tsec, s.tspkey)
	return nil
}

func (s *SignupEngine) join(a libkb.LoginContext, username, email, inviteCode string, skipMail bool) error {
	joinEngine := NewSignupJoinEngine(s.G())

	arg := SignupJoinEngineRunArg{
		Username:   username,
		Email:      email,
		InviteCode: inviteCode,
		PWHash:     s.tspkey.PWHash(),
		PWSalt:     s.pwsalt,
		SkipMail:   skipMail,
	}
	res := joinEngine.Run(a, arg)
	if res.Err != nil {
		return res
	}

	s.uid = res.UID
	user, err := libkb.LoadUser(libkb.LoadUserArg{Self: true, UID: res.UID, PublicKeyOptional: true})
	if err != nil {
		return err
	}
	s.me = user
	return nil
}

func (s *SignupEngine) registerDevice(a libkb.LoginContext, ctx *Context, deviceName string) error {
	s.lks = libkb.NewLKSec(s.tspkey.LksClientHalf(), s.uid, s.G())
	args := &DeviceWrapArgs{
		Me:         s.me,
		DeviceName: deviceName,
		Lks:        s.lks,
		IsEldest:   true,
	}
	eng := NewDeviceWrap(args, s.G())
	ctx.LoginContext = a
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}
	s.signingKey = eng.SigningKey()

	ctx.LoginContext.LocalSession().SetDeviceProvisioned(s.G().Env.GetDeviceID().String())

	if s.arg.SecretStorer != nil {
		secret, err := s.lks.GetSecret()
		if err != nil {
			return err
		}
		// Ignore any errors storing the secret.
		_ = s.arg.SecretStorer.StoreSecret(secret)
	}

	return nil
}

func (s *SignupEngine) genDetKeys(ctx *Context) error {
	arg := &DetKeyArgs{
		Tsp:         s.tspkey,
		Me:          s.me,
		SigningKey:  s.signingKey,
		EldestKeyID: s.signingKey.GetKid(),
	}
	eng := NewDetKeyEngine(arg, s.G())
	return RunEngine(eng, ctx)
}

func (s *SignupEngine) checkGPG(ctx *Context) (bool, error) {
	eng := NewGPGImportKeyEngine(nil, s.G())
	return eng.WantsGPG(ctx)
}

func (s *SignupEngine) addGPG(lctx libkb.LoginContext, ctx *Context, allowMulti bool) error {
	s.G().Log.Debug("SignupEngine.addGPG.  signingKey: %v\n", s.signingKey)
	arg := GPGImportKeyArg{Signer: s.signingKey, AllowMulti: allowMulti, Me: s.me, Lks: s.lks}
	eng := NewGPGImportKeyEngine(&arg, s.G())
	ctx.LoginContext = lctx
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	if s.signingKey == nil {
		s.signingKey = eng.LastKey()
	}
	return nil
}
