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
}

func NewLKSec() *LKSec {
	return &LKSec{}
}

func NewLKSecClientHalf(clientHalf []byte) *LKSec {
	s := NewLKSec()
	s.clientHalf = clientHalf
	return s
}

func NewLKSecSecret(secret []byte) *LKSec {
	s := NewLKSec()
	s.secret = secret
	return s
}

func (s *LKSec) SetClientHalf(b []byte) {
	s.clientHalf = b
}

func (s *LKSec) Load() error {
	if s.secret != nil {
		return nil
	}

	if len(s.clientHalf) == 0 {
		return fmt.Errorf("client half not set")
	}

	devid := G.Env.GetDeviceID()
	if devid == nil {
		return fmt.Errorf("no device id set")
	}

	if err := s.apiServerHalf(devid); err != nil {
		return err
	}

	if len(s.clientHalf) != len(s.serverHalf) {
		return fmt.Errorf("client/server halves len mismatch: len(client) == %d, len(server) = %d", len(s.clientHalf), len(s.serverHalf))
	}

	s.secret = make([]byte, len(s.serverHalf))
	XORBytes(s.secret, s.serverHalf, s.clientHalf)

	return nil
}

func (s *LKSec) Encrypt(src []byte) ([]byte, error) {
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
	if err := s.Load(); err != nil {
		return nil, err
	}
	var nonce [24]byte
	copy(nonce[:], src[0:24])
	data := src[24:]
	fs := s.fsecret()
	res, ok := secretbox.Open(nil, data, &nonce, &fs)
	if !ok {
		return nil, fmt.Errorf("failed to open secretbox")
	}

	return res, nil
}

func (s *LKSec) fsecret() (res [32]byte) {
	copy(res[:], s.secret)
	return res
}

func (s *LKSec) apiServerHalf(devid *DeviceID) error {
	if err := G.SecretSyncer.Load(*(G.Env.GetUID())); err != nil {
		return err
	}
	dev, err := G.SecretSyncer.FindDevice(devid)
	if err != nil {
		return err
	}
	s.serverHalf, err = hex.DecodeString(dev.LksServerHalf)
	return err
}
