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
	VerifyEmail              bool

	// Used in tests for reproducible key generation
	naclSigningKeyPair    libkb.NaclKeyPair
	naclEncryptionKeyPair libkb.NaclKeyPair
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
	defer m.Trace("SignupEngine#Run", func() error { return err })()

	// Make sure we're starting with a clear login state. But check
	// if it's fine to logout current user.
	if clRes := libkb.CanLogout(m); !clRes.CanLogout {
		return fmt.Errorf("Cannot signup because of currently logged in user: %s", clRes.Reason)
	}

	if err = m.G().Logout(m.Ctx()); err != nil {
		return err
	}

	// StoreSecret is required if we are doing NOPW
	if !s.arg.StoreSecret && s.arg.GenerateRandomPassphrase {
		return fmt.Errorf("cannot SignUp with StoreSecret=false and GenerateRandomPassphrase=true")
	}

	// check if secret store works
	if s.arg.StoreSecret {
		if ss := m.G().SecretStore(); ss != nil {
			if s.arg.GenerateRandomPassphrase && !ss.IsPersistent() {
				// IsPersistent returns true if SecretStoreLocked is
				// disk-backed, and false if it's only memory backed.
				return SecretStoreNotFunctionalError{err: fmt.Errorf("persistent secret store is required for no-passphrase signup")}
			}

			err = ss.PrimeSecretStores(m)
			if err != nil {
				return SecretStoreNotFunctionalError{err}
			}
		} else if s.arg.GenerateRandomPassphrase {
			return SecretStoreNotFunctionalError{err: fmt.Errorf("secret store is required for no-passphrase signup but wasn't found")}
		} else {
			m.Debug("There is no secret store, but we are continuing because this is not a NOPW")
		}
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

	if err = s.registerDevice(m, s.arg.DeviceName, s.arg.GenerateRandomPassphrase); err != nil {
		return err
	}

	m.Info("Signed up and provisioned a device.")

	// After we are provisioned, do not fail the signup process. Everything
	// else happening here is optional.

	if !s.arg.SkipPaper {
		if err = s.genPaperKeys(m); err != nil {
			m.Warning("Paper key was not generated. Failed with an error: %s", err)
		}
	}

	// GenPGPBatch can be set in devel CLI to generate
	// a pgp key and push it to the server without any
	// user interaction to make testing easier.
	if s.arg.GenPGPBatch {
		if err = s.genPGPBatch(m); err != nil {
			m.Warning("genPGPBatch failed with an error: %s", err)
		}
	}

	if err := s.doGPG(m); err != nil {
		// We don't care if GPG import fails, continue with the signup process
		// because it's too late anyway. Failing here would leave a signed up
		// and logged in user in a weird state where their GUI does not know
		// they are logged in, and also other processes (CreateWallet) will not
		// run.
		m.Warning("Attempt at importing PGP keys from GPG failed with: %s", err)
	}

	m = m.CommitProvisionalLogin()

	// signup complete, notify anyone interested.
	m.G().NotifyRouter.HandleSignup(m.Ctx(), s.arg.Username)

	// For instance, setup gregor and friends...
	m.G().CallLoginHooks(m)

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
	m.Debug("SignupEngine#join")
	joinEngine := NewSignupJoinEngine(m.G())

	pdpkda5kid, err := s.ppStream.PDPKA5KID()
	if err != nil {
		return err
	}

	arg := SignupJoinEngineRunArg{
		Username:    username,
		Email:       email,
		InviteCode:  inviteCode,
		PWHash:      s.ppStream.PWHash(),
		PWSalt:      s.pwsalt,
		RandomPW:    randomPW,
		SkipMail:    skipMail,
		PDPKA5KID:   pdpkda5kid,
		VerifyEmail: s.arg != nil && s.arg.VerifyEmail,
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

func (s *SignupEngine) registerDevice(m libkb.MetaContext, deviceName string, randomPw bool) error {
	m.Debug("SignupEngine#registerDevice")
	s.lks = libkb.NewLKSec(s.ppStream, s.uid)
	args := &DeviceWrapArgs{
		Me:                    s.me,
		DeviceName:            libkb.CheckDeviceName.Transform(deviceName),
		Lks:                   s.lks,
		IsEldest:              true,
		naclSigningKeyPair:    s.arg.naclSigningKeyPair,
		naclEncryptionKeyPair: s.arg.naclEncryptionKeyPair,
	}

	if !libkb.CheckDeviceName.F(s.arg.DeviceName) {
		m.Debug("invalid device name supplied: %s", s.arg.DeviceName)
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
	err := RunEngine2(m, eng)
	if err != nil {
		m.Warning("Failed to provision device: %s", err)
		if ssErr := s.storeSecretForRecovery(m); ssErr != nil {
			m.Warning("Failed to store secrets for recovery: %s", ssErr)
		}
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
		m.Warning("error saving session file: %s", err)
	}

	s.storeSecret(m, randomPw)

	m.Debug("registered new device: %s", m.G().Env.GetDeviceID())
	m.Debug("eldest kid: %s", s.me.GetEldestKID())

	return nil
}

func (s *SignupEngine) storeSecret(m libkb.MetaContext, randomPw bool) {
	defer m.Trace("SignupEngine#storeSecret", func() error { return nil })()

	// Create the secret store as late as possible here, as the username may
	// change during the signup process.
	if !s.arg.StoreSecret {
		m.Debug("not storing secret; disabled")
		return
	}

	w := libkb.StoreSecretAfterLoginWithLKSWithOptions(m, s.me.GetNormalizedName(), s.lks, &libkb.SecretStoreOptions{RandomPw: randomPw})
	if w != nil {
		m.Warning("StoreSecret error: %s", w)
	}
}

func (s *SignupEngine) storeSecretForRecovery(m libkb.MetaContext) (err error) {
	defer m.Trace("SignupEngine#storeSecretForRecovery", func() error { return err })()

	if !s.arg.GenerateRandomPassphrase {
		m.Debug("Not GenerateRandomPassphrase - skipping storeSecretForRecovery")
		return nil
	}

	username := s.me.GetNormalizedName()
	err = libkb.StorePwhashEddsaPassphraseStream(m, username, s.ppStream)
	if err != nil {
		return err
	}

	return nil
}

func (s *SignupEngine) genPaperKeys(m libkb.MetaContext) error {
	m.Debug("SignupEngine#genPaperKeys")
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
	defer m.Trace(fmt.Sprintf("SignupEngine.addGPG(signingKey: %v)", s.signingKey), func() error { return err })()

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
	m.Debug("SignupEngine#genPGPBatch")
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
