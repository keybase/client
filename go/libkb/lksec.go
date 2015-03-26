package libkb

import (
	"encoding/hex"
	"fmt"

	"golang.org/x/crypto/nacl/secretbox"
)

const LKSecVersion = 100

type LKSec struct {
	serverHalf []byte
	clientHalf []byte
	secret     []byte
	uid        *UID
}

func NewLKSec(clientHalf []byte) *LKSec {
	return &LKSec{clientHalf: clientHalf}
}

func (l *LKSec) SetUID(u *UID) {
	l.uid = u
}

func (s *LKSec) SetClientHalf(b []byte) {
	s.clientHalf = b
}

func (s *LKSec) GenerateServerHalf() error {
	if s.clientHalf == nil {
		return fmt.Errorf("Can't generate server half without a client half")
	}
	var err error
	s.serverHalf, err = RandBytes(len(s.clientHalf))
	return err
}

func (s *LKSec) GetServerHalf() []byte {
	return s.serverHalf
}

func (s *LKSec) Load() error {

	G.Log.Debug("+ LKSec::load()")
	defer func() {
		G.Log.Debug("- LKSec::Load()")
	}()

	if s.secret != nil {
		G.Log.Debug("| Short-circuit; we already know the full secret")
		return nil
	}

	if len(s.clientHalf) == 0 {
		return fmt.Errorf("client half not set")
	}

	if s.serverHalf == nil {
		G.Log.Debug("| Fetching secret key")
		devid := G.Env.GetDeviceID()
		if devid == nil {
			return fmt.Errorf("no device id set")
		}

		if err := s.apiServerHalf(devid); err != nil {
			return err
		}
	} else {
		G.Log.Debug("| ServerHalf already loaded")
	}

	if len(s.clientHalf) != len(s.serverHalf) {
		return fmt.Errorf("client/server halves len mismatch: len(client) == %d, len(server) = %d", len(s.clientHalf), len(s.serverHalf))
	}

	s.secret = make([]byte, len(s.serverHalf))
	XORBytes(s.secret, s.serverHalf, s.clientHalf)
	G.Log.Debug("| Making XOR'ed secret key for Local Key Security (LKS): ServerHalf=%s; clientHalf=%s",
		hex.EncodeToString(s.serverHalf), hex.EncodeToString(s.clientHalf))

	return nil
}

func (s *LKSec) Encrypt(src []byte) ([]byte, error) {
	G.Log.Debug("+ LKsec:Encrypt()")
	defer func() {
		G.Log.Debug("- LKSec::Encrypt()")
	}()

	if err := s.Load(); err != nil {
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

func (s *LKSec) Decrypt(src []byte) ([]byte, error) {
	G.Log.Debug("+ LKsec:Decrypt()")
	defer func() {
		G.Log.Debug("- LKSec::Decrypt()")
	}()

	if err := s.Load(); err != nil {
		return nil, err
	}
	var nonce [24]byte
	copy(nonce[:], src[0:24])
	data := src[24:]
	fs := s.fsecret()
	res, ok := secretbox.Open(nil, data, &nonce, &fs)
	if !ok {
		return nil, PassphraseError{"failed to open secretbox"}
	}

	return res, nil
}

func (s *LKSec) fsecret() (res [32]byte) {
	copy(res[:], s.secret)
	return res
}

func (s *LKSec) apiServerHalf(devid *DeviceID) error {
	ss := G.SecretSyncer
	if err := RunSyncer(ss, s.uid); err != nil {
		return err
	}
	dev, err := ss.FindDevice(devid)
	if err != nil {
		return err
	}
	s.serverHalf, err = hex.DecodeString(dev.LksServerHalf)
	return err
}

// GetLKSForEncrypt gets a verified passphrase stream, and returns
// an LKS that works for encryption.
func NewLKSForEncrypt(ui SecretUI) (ret *LKSec, err error) {
	var pps PassphraseStream
	if pps, err = G.LoginState.GetPassphraseStream(ui); err != nil {
		return
	}
	ret = NewLKSec(pps.LksClientHalf())
	return
}
