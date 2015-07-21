package libkb

import (
	"encoding/hex"
	"fmt"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/nacl/secretbox"
)

const LKSecVersion = 100

type LKSec struct {
	serverHalf []byte
	clientHalf []byte
	secret     []byte
	ppGen      PassphraseGeneration
	uid        keybase1.UID
	Contextified
}

func NewLKSec(clientHalf []byte, ppGen PassphraseGeneration, uid keybase1.UID, gc *GlobalContext) *LKSec {
	return &LKSec{
		clientHalf:   clientHalf,
		ppGen:        ppGen,
		uid:          uid,
		Contextified: NewContextified(gc),
	}
}

func NewLKSecWithFullSecret(secret []byte, uid keybase1.UID, gc *GlobalContext) *LKSec {
	return &LKSec{
		secret:       secret,
		ppGen:        PassphraseGeneration(-1),
		uid:          uid,
		Contextified: NewContextified(gc),
	}
}

func (s *LKSec) SetUID(u keybase1.UID) {
	s.uid = u
}

func (s *LKSec) SetClientHalf(b []byte) {
	s.clientHalf = b
}

// Generation returns the passphrase generation that this local key security
// object is derived from.
func (s LKSec) Generation() PassphraseGeneration {
	return s.ppGen
}

func (s *LKSec) GenerateServerHalf() error {
	if s.clientHalf == nil {
		return fmt.Errorf("Can't generate server half without a client half")
	}
	if s.serverHalf != nil {
		return nil
	}
	var err error
	s.serverHalf, err = RandBytes(len(s.clientHalf))
	return err
}

func (s *LKSec) GetServerHalf() []byte {
	return s.serverHalf
}

func (s *LKSec) Load(lctx LoginContext) error {
	s.G().Log.Debug("+ LKSec::Load()")
	defer func() {
		s.G().Log.Debug("- LKSec::Load()")
	}()

	if s.secret != nil {
		s.G().Log.Debug("| Short-circuit; we already know the full secret")
		return nil
	}

	if len(s.clientHalf) == 0 {
		return fmt.Errorf("client half not set")
	}

	if len(s.serverHalf) == 0 {
		s.G().Log.Debug("| Fetching secret key")
		devid := s.G().Env.GetDeviceID()
		if devid.IsNil() {
			return fmt.Errorf("no device id set")
		}

		if err := s.apiServerHalf(lctx, devid); err != nil {
			return err
		}
		if len(s.serverHalf) == 0 {
			return fmt.Errorf("after apiServerHalf(%s), serverHalf still empty", devid)
		}
	} else {
		s.G().Log.Debug("| ServerHalf already loaded")
	}

	if len(s.clientHalf) != len(s.serverHalf) {
		return fmt.Errorf("client/server halves len mismatch: len(client) == %d, len(server) = %d", len(s.clientHalf), len(s.serverHalf))
	}

	s.secret = make([]byte, len(s.serverHalf))
	XORBytes(s.secret, s.serverHalf, s.clientHalf)
	s.G().Log.Debug("| Making XOR'ed secret key for Local Key Security (LKS): ServerHalf=%x; clientHalf=%x", s.serverHalf, s.clientHalf)

	return nil
}

func (s *LKSec) GetSecret() (secret []byte, err error) {
	s.G().Log.Debug("+ LKsec:GetSecret()")
	defer func() {
		s.G().Log.Debug("- LKSec::GetSecret()")
	}()

	if err = s.Load(nil); err != nil {
		return
	}

	secret = s.secret
	return
}

func (s *LKSec) Encrypt(src []byte) ([]byte, error) {
	s.G().Log.Debug("+ LKsec:Encrypt()")
	defer func() {
		s.G().Log.Debug("- LKSec::Encrypt()")
	}()

	if err := s.Load(nil); err != nil {
		return nil, err
	}
	nonce, err := RandBytes(24)
	if err != nil {
		return nil, err
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	fs := s.fsecret()
	box := secretbox.Seal(nil, src, &fnonce, &fs)

	return append(nonce, box...), nil
}

func (s *LKSec) Decrypt(lctx LoginContext, src []byte) ([]byte, PassphraseGeneration, error) {
	s.G().Log.Debug("+ LKsec:Decrypt()")
	defer func() {
		s.G().Log.Debug("- LKSec::Decrypt()")
	}()

	if err := s.Load(lctx); err != nil {
		return nil, 0, fmt.Errorf("lksec decrypt Load err: %s", err)
	}
	var nonce [24]byte
	copy(nonce[:], src[0:24])
	data := src[24:]
	fs := s.fsecret()
	res, ok := secretbox.Open(nil, data, &nonce, &fs)
	if !ok {
		return nil, 0, PassphraseError{"failed to open secretbox"}
	}

	return res, s.ppGen, nil
}

func (s *LKSec) fsecret() (res [32]byte) {
	copy(res[:], s.secret)
	return res
}

func (s *LKSec) apiServerHalf(lctx LoginContext, devid keybase1.DeviceID) error {
	var err error
	var dev DeviceKey
	if lctx != nil {
		if err := lctx.RunSecretSyncer(s.uid); err != nil {
			return err
		}
		dev, err = lctx.SecretSyncer().FindDevice(devid)
	} else {
		aerr := s.G().LoginState().Account(func(a *Account) {
			if err = RunSyncer(a.SecretSyncer(), s.uid, a.LoggedIn(), a.LocalSession()); err != nil {
				return
			}
			dev, err = a.SecretSyncer().FindDevice(devid)
		}, "LKSec apiServerHalf - find device")
		if aerr != nil {
			return aerr
		}
	}
	if err != nil {
		return err
	}

	sh, err := hex.DecodeString(dev.LksServerHalf)
	if err != nil {
		return err
	}

	s.serverHalf = sh
	s.ppGen = dev.PPGen
	return nil
}

// NewLKSForEncrypt gets a verified passphrase stream, and returns
// an LKS that works for encryption.
func NewLKSForEncrypt(ui SecretUI, uid keybase1.UID, gc *GlobalContext) (ret *LKSec, err error) {
	var pps *PassphraseStream
	if pps, err = gc.LoginState().GetPassphraseStream(ui); err != nil {
		return
	}
	ret = NewLKSec(pps.LksClientHalf(), pps.Generation(), uid, gc)
	return
}

// EncryptClientHalfRecovery takes the client half of the LKS secret
// and ecrypts it for the given key.  This is for recovery of passphrases
// on device recovery operations.
func (s *LKSec) EncryptClientHalfRecovery(key GenericKey) (string, error) {
	return key.EncryptToString(s.clientHalf, nil)
}
