// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	triplesec "github.com/keybase/go-triplesec"
)

type SignupEngine struct {
	pwsalt        []byte
	ppStream      *libkb.PassphraseStream
	tsec          *triplesec.Cipher
	uid           keybase1.UID
	me            *libkb.User
	signingKey    libkb.GenericKey
	encryptionKey libkb.GenericKey
	arg           *SignupEngineRunArg
	lks           *libkb.LKSec
	libkb.Contextified
}

type SignupEngineRunArg struct {
	Username    string
	Email       string
	InviteCode  string
	Passphrase  string
	StoreSecret bool
	DeviceName  string
	SkipGPG     bool
	SkipMail    bool
	SkipPaper   bool
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
		&GPGImportKeyEngine{},
		&DeviceWrap{},
		&PaperKeyPrimary{},
	}
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
		if err := s.genPassphraseStream(a, s.arg.Passphrase); err != nil {
			return err
		}

		if err := s.join(a, s.arg.Username, s.arg.Email, s.arg.InviteCode, s.arg.SkipMail); err != nil {
			return err
		}

		if err := s.registerDevice(a, ctx, s.arg.DeviceName); err != nil {
			return err
		}

		if !s.arg.SkipPaper {
			if err := s.genPaperKeys(ctx); err != nil {
				return err
			}
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

	if err := s.G().LoginState().ExternalFunc(f, "SignupEngine - Run"); err != nil {
		return err
	}

	// signup complete, notify anyone interested.
	// (and don't notify inside a LoginState action to avoid
	// a chance of timing out)
	s.G().NotifyRouter.HandleLogin(s.arg.Username)

	// For instance, setup gregor and friends...
	s.G().CallLoginHooks()

	return nil

}

func (s *SignupEngine) genPassphraseStream(a libkb.LoginContext, passphrase string) error {
	salt, err := libkb.RandBytes(triplesec.SaltLen)
	if err != nil {
		return err
	}
	s.pwsalt = salt
	s.tsec, s.ppStream, err = libkb.StretchPassphrase(passphrase, salt)
	if err != nil {
		return err
	}
	return nil
}

func (s *SignupEngine) join(a libkb.LoginContext, username, email, inviteCode string, skipMail bool) error {
	joinEngine := NewSignupJoinEngine(s.G())

	arg := SignupJoinEngineRunArg{
		Username:   username,
		Email:      email,
		InviteCode: inviteCode,
		PWHash:     s.ppStream.PWHash(),
		PWSalt:     s.pwsalt,
		SkipMail:   skipMail,
	}
	res := joinEngine.Run(a, arg)
	if res.Err != nil {
		return res
	}

	s.ppStream.SetGeneration(res.PpGen)
	a.CreateStreamCache(s.tsec, s.ppStream)

	s.uid = res.UID
	s.G().Log.Debug("contextified: %v\n", s.G())
	user, err := libkb.LoadUser(libkb.LoadUserArg{Self: true, UID: res.UID, PublicKeyOptional: true, Contextified: libkb.NewContextified(s.G())})
	if err != nil {
		return err
	}
	s.me = user
	return nil
}

func (s *SignupEngine) registerDevice(a libkb.LoginContext, ctx *Context, deviceName string) error {
	s.lks = libkb.NewLKSec(s.ppStream, s.uid, s.G())
	args := &DeviceWrapArgs{
		Me:         s.me,
		DeviceName: deviceName,
		DeviceType: libkb.DeviceTypeDesktop,
		Lks:        s.lks,
		IsEldest:   true,
	}
	eng := NewDeviceWrap(args, s.G())
	ctx.LoginContext = a
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}
	s.signingKey = eng.SigningKey()
	s.encryptionKey = eng.EncryptionKey()

	if err := ctx.LoginContext.LocalSession().SetDeviceProvisioned(s.G().Env.GetDeviceID()); err != nil {
		// this isn't a fatal error, session will stay in memory...
		s.G().Log.Warning("error saving session file: %s", err)
	}

	if s.arg.StoreSecret {
		// Create the secret store as late as possible here
		// (instead of when we first get the value of
		// StoreSecret) as the username may change during the
		// signup process.
		secretStore := libkb.NewSecretStore(s.G(), s.me.GetNormalizedName())
		secret, err := s.lks.GetSecret(a)
		if err != nil {
			return err
		}
		// Ignore any errors storing the secret.
		storeSecretErr := secretStore.StoreSecret(secret)
		if storeSecretErr != nil {
			s.G().Log.Warning("StoreSecret error: %s", storeSecretErr)
		}
	}

	s.G().Log.Debug("registered new device: %s", s.G().Env.GetDeviceID())
	s.G().Log.Debug("eldest kid: %s", s.me.GetEldestKID())

	return nil
}

func (s *SignupEngine) genPaperKeys(ctx *Context) error {
	args := &PaperKeyPrimaryArgs{
		Me:         s.me,
		SigningKey: s.signingKey,
	}
	eng := NewPaperKeyPrimary(s.G(), args)
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
