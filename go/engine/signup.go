// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/base64"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	triplesec "github.com/keybase/go-triplesec"
)

// For password-less signups, number of bytes that are randomly generated
// and then encoded with base64 to be used as user's passphrase.
const randomPassphraseLen = 16

type SignupEngine struct {
	pwsalt         []byte
	ppStream       *libkb.PassphraseStream
	tsec           libkb.Triplesec
	uid            keybase1.UID
	me             *libkb.User
	signingKey     libkb.GenericKey
	encryptionKey  libkb.NaclDHKeyPair
	arg            *SignupEngineRunArg
	lks            *libkb.LKSec
	perUserKeyring *libkb.PerUserKeyring // Created after provisioning. Sent to paperkey gen.
}

var _ Engine2 = (*SignupEngine)(nil)

type SignupEngineRunArg struct {
	Username                 string
	Email                    string
	InviteCode               string
	Passphrase               string
	GenerateRandomPassphrase bool
	StoreSecret              bool
	DeviceName               string
	DeviceType               keybase1.DeviceType
	SkipGPG                  bool
	SkipMail                 bool
	SkipPaper                bool
	GenPGPBatch              bool // if true, generate and push a pgp key to the server (no interaction)
}

func NewSignupEngine(g *libkb.GlobalContext, arg *SignupEngineRunArg) *SignupEngine {
	return &SignupEngine{
		arg: arg,
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

func (s *SignupEngine) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("SignupEngine#Run", func() error { return err })()

	// make sure we're starting with a clear login state:
	if err = m.G().Logout(m.Ctx()); err != nil {
		return err
	}

	m = m.WithNewProvisionalLoginContext()

	if err = s.genPassphraseStream(m, s.arg.Passphrase, s.arg.GenerateRandomPassphrase); err != nil {
		return err
	}

	if err = s.join(m, s.arg.Username, s.arg.Email, s.arg.InviteCode, s.arg.SkipMail, s.arg.GenerateRandomPassphrase); err != nil {
		return err
	}

	s.perUserKeyring, err = libkb.NewPerUserKeyring(m.G(), s.uid)
	if err != nil {
		return err
	}

	if err = s.registerDevice(m, s.arg.DeviceName); err != nil {
		return err
	}

	if !s.arg.SkipPaper {
		if err = s.genPaperKeys(m); err != nil {
			return err
		}
	}

	// GenPGPBatch can be set in devel CLI to generate
	// a pgp key and push it to the server without any
	// user interaction to make testing easier.
	if s.arg.GenPGPBatch {
		if err = s.genPGPBatch(m); err != nil {
			return err
		}
	}

	if err = s.doGPG(m); err != nil {
		return err
	}

	m = m.CommitProvisionalLogin()

	// signup complete, notify anyone interested.
	m.G().NotifyRouter.HandleLogin(s.arg.Username)

	// For instance, setup gregor and friends...
	m.G().CallLoginHooks()

	m.G().GetStellar().CreateWalletSoft(m.Ctx())

	return nil
}

func (s *SignupEngine) doGPG(m libkb.MetaContext) error {

	if s.arg.SkipGPG {
		return nil
	}

	// only desktop potentially has gpg, so if not desktop then
	// bail out
	if s.arg.DeviceType != keybase1.DeviceType_DESKTOP {
		return nil
	}

	if wantsGPG, err := s.checkGPG(m); err != nil {
		return err
	} else if wantsGPG {
		if err := s.addGPG(m, true, true); err != nil {
			return fmt.Errorf("addGPG error: %s", err)
		}
	}
	return nil
}

func (s *SignupEngine) genRandomPassphrase(m libkb.MetaContext) (string, error) {
	str, err := libkb.RandBytes(randomPassphraseLen)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(str), nil
}

func (s *SignupEngine) genPassphraseStream(m libkb.MetaContext, passphrase string, randomPW bool) error {
	if randomPW {
		if len(passphrase) != 0 {
			return fmt.Errorf("Tried to generate random passphrase but also provided passphrase argument")
		}
		var err error
		passphrase, err = s.genRandomPassphrase(m)
		if err != nil {
			return err
		}
	}
	if len(passphrase) < libkb.MinPassphraseLength {
		return libkb.PassphraseError{Msg: fmt.Sprintf("Passphrase must be at least %d characters", libkb.MinPassphraseLength)}
	}
	salt, err := libkb.RandBytes(triplesec.SaltLen)
	if err != nil {
		return err
	}
	s.pwsalt = salt
	s.tsec, s.ppStream, err = libkb.StretchPassphrase(m.G(), passphrase, salt)
	if err != nil {
		return err
	}
	return nil
}

func (s *SignupEngine) join(m libkb.MetaContext, username, email, inviteCode string, skipMail bool, randomPW bool) error {
	m.CDebugf("SignupEngine#join")
	joinEngine := NewSignupJoinEngine(m.G())

	pdpkda5kid, err := s.ppStream.PDPKA5KID()
	if err != nil {
		return err
	}

	arg := SignupJoinEngineRunArg{
		Username:   username,
		Email:      email,
		InviteCode: inviteCode,
		PWHash:     s.ppStream.PWHash(),
		PWSalt:     s.pwsalt,
		RandomPW:   randomPW,
		SkipMail:   skipMail,
		PDPKA5KID:  pdpkda5kid,
	}
	res := joinEngine.Run(m, arg)
	if res.Err != nil {
		return res
	}

	s.ppStream.SetGeneration(res.PpGen)
	m.LoginContext().CreateStreamCache(s.tsec, s.ppStream)

	s.uid = res.UV.Uid
	luArg := libkb.NewLoadUserArgWithMetaContext(m).WithSelf(true).WithUID(res.UV.Uid).WithPublicKeyOptional()
	user, err := libkb.LoadUser(luArg)
	if err != nil {
		return err
	}

	s.me = user
	return nil
}

func (s *SignupEngine) registerDevice(m libkb.MetaContext, deviceName string) error {
	m.CDebugf("SignupEngine#registerDevice")
	s.lks = libkb.NewLKSec(s.ppStream, s.uid)
	args := &DeviceWrapArgs{
		Me:         s.me,
		DeviceName: deviceName,
		Lks:        s.lks,
		IsEldest:   true,
	}

	if !libkb.CheckDeviceName.F(s.arg.DeviceName) {
		m.CDebugf("invalid device name supplied: %s", s.arg.DeviceName)
		return libkb.DeviceBadNameError{}
	}

	switch s.arg.DeviceType {
	case keybase1.DeviceType_DESKTOP:
		args.DeviceType = libkb.DeviceTypeDesktop
	case keybase1.DeviceType_MOBILE:
		args.DeviceType = libkb.DeviceTypeMobile
	default:
		return fmt.Errorf("unknown device type: %v", s.arg.DeviceType)
	}

	eng := NewDeviceWrap(m.G(), args)
	if err := RunEngine2(m, eng); err != nil {
		return err
	}
	if err := eng.SwitchConfigAndActiveDevice(m); err != nil {
		return err
	}
	s.signingKey = eng.SigningKey()
	s.encryptionKey = eng.EncryptionKey()
	did := eng.DeviceID()

	if err := m.LoginContext().LocalSession().SetDeviceProvisioned(did); err != nil {
		// this isn't a fatal error, session will stay in memory...
		m.CWarningf("error saving session file: %s", err)
	}

	s.storeSecret(m)

	m.CDebugf("registered new device: %s", m.G().Env.GetDeviceID())
	m.CDebugf("eldest kid: %s", s.me.GetEldestKID())

	return nil
}

func (s *SignupEngine) storeSecret(m libkb.MetaContext) {
	defer m.CTrace("SignupEngine#storeSecret", func() error { return nil })()

	// Create the secret store as late as possible here, as the username may
	// change during the signup process.
	if !s.arg.StoreSecret {
		m.CDebugf("not storing secret; disabled")
		return
	}

	w := libkb.StoreSecretAfterLoginWithLKS(m, s.me.GetNormalizedName(), s.lks)
	if w != nil {
		m.CWarningf("StoreSecret error: %s", w)
	}
}

func (s *SignupEngine) genPaperKeys(m libkb.MetaContext) error {
	m.CDebugf("SignupEngine#genPaperKeys")
	// Load me again so that keys will be up to date.
	var err error
	s.me, err = libkb.LoadUser(libkb.NewLoadUserArgWithMetaContext(m).WithSelf(true).WithUID(s.me.GetUID()).WithPublicKeyOptional())
	if err != nil {
		return err
	}

	args := &PaperKeyPrimaryArgs{
		Me:             s.me,
		SigningKey:     s.signingKey,
		EncryptionKey:  s.encryptionKey,
		PerUserKeyring: s.perUserKeyring,
	}

	eng := NewPaperKeyPrimary(m.G(), args)
	return RunEngine2(m, eng)
}

func (s *SignupEngine) checkGPG(m libkb.MetaContext) (bool, error) {
	eng := NewGPGImportKeyEngine(m.G(), nil)
	return eng.WantsGPG(m)
}

func (s *SignupEngine) addGPG(m libkb.MetaContext, allowMulti bool, hasProvisionedDevice bool) (err error) {
	defer m.CTrace(fmt.Sprintf("SignupEngine.addGPG(signingKey: %v)", s.signingKey), func() error { return err })()

	arg := GPGImportKeyArg{Signer: s.signingKey, AllowMulti: allowMulti, Me: s.me, Lks: s.lks, HasProvisionedDevice: hasProvisionedDevice}
	eng := NewGPGImportKeyEngine(m.G(), &arg)
	if err = RunEngine2(m, eng); err != nil {
		return err
	}

	if s.signingKey == nil {
		s.signingKey = eng.LastKey()
	}
	return nil
}

func (s *SignupEngine) genPGPBatch(m libkb.MetaContext) error {
	m.CDebugf("SignupEngine#genPGPBatch")
	gen := libkb.PGPGenArg{
		PrimaryBits: 1024,
		SubkeyBits:  1024,
	}

	// genPGPBatch should never be run in production, but if there's
	// a bug or a mistunderstanding in the future, generate a good key.
	if m.G().Env.GetRunMode() != libkb.DevelRunMode {
		gen.PrimaryBits = 4096
		gen.SubkeyBits = 4096
	}
	gen.AddDefaultUID(m.G())

	tsec, sgen := m.LoginContext().PassphraseStreamCache().TriplesecAndGeneration()

	eng := NewPGPKeyImportEngine(m.G(), PGPKeyImportEngineArg{
		Gen:              &gen,
		PushSecret:       true,
		Lks:              s.lks,
		NoSave:           true,
		PreloadTsec:      tsec,
		PreloadStreamGen: sgen,
	})

	return RunEngine2(m, eng)
}
