// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"errors"
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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

func NewLKSec(pps *PassphraseStream, uid keybase1.UID, gc *GlobalContext) *LKSec {
	res := &LKSec{
		uid:          uid,
		Contextified: NewContextified(gc),
	}

	if pps != nil {
		res.clientHalf = pps.LksClientHalf()
		res.ppGen = pps.Generation()
	}
	return res
}

func NewLKSecWithClientHalf(clientHalf []byte, ppgen PassphraseGeneration, uid keybase1.UID, gc *GlobalContext) *LKSec {
	return &LKSec{
		clientHalf:   clientHalf,
		ppGen:        ppgen,
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

func (s *LKSec) SetServerHalf(b []byte) {
	s.serverHalf = b
}

// Generation returns the passphrase generation that this local key security
// object is derived from.
func (s LKSec) Generation() PassphraseGeneration {
	return s.ppGen
}

func (s *LKSec) GenerateServerHalf() error {
	if s.clientHalf == nil {
		return errors.New("Can't generate server half without a client half")
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

func (s *LKSec) Load(lctx LoginContext) (err error) {
	s.G().Log.Debug("+ LKSec::Load()")
	defer func() {
		s.G().Log.Debug("- LKSec::Load() -> %s", ErrToOk(err))
	}()

	if s.secret != nil {
		s.G().Log.Debug("| Short-circuit; we already know the full secret")
		return nil
	}

	if len(s.clientHalf) == 0 {
		err = fmt.Errorf("client half not set")
		return err
	}

	if err = s.LoadServerHalf(lctx); err != nil {
		return err
	}

	if len(s.clientHalf) != len(s.serverHalf) {
		err = fmt.Errorf("client/server halves len mismatch: len(client) == %d, len(server) = %d", len(s.clientHalf), len(s.serverHalf))
		return err
	}

	s.secret = make([]byte, len(s.serverHalf))
	XORBytes(s.secret, s.serverHalf, s.clientHalf)
	s.G().Log.Debug("| Making XOR'ed secret key for Local Key Security (LKS)")

	return nil
}

func (s *LKSec) LoadServerHalf(lctx LoginContext) (err error) {
	s.G().Log.Debug("+ LKSec::LoadServerHalf()")
	defer func() {
		s.G().Log.Debug("- LKSec::LoadServerHalf() -> %s", ErrToOk(err))
	}()

	if len(s.serverHalf) != 0 {
		s.G().Log.Debug("| short-circuit: already have serverHalf")
		return nil
	}
	s.G().Log.Debug("| Fetching server half")
	devid := s.G().Env.GetDeviceID()
	if devid.IsNil() {
		return fmt.Errorf("lksec load: no device id set, thus can't fetch server half")
	}

	if err = s.apiServerHalf(lctx, devid); err != nil {
		s.G().Log.Debug("apiServerHalf(%s) error: %s", devid, err)
		return err
	}
	if len(s.serverHalf) == 0 {
		return fmt.Errorf("after apiServerHalf(%s), serverHalf still empty", devid)
	}

	return nil
}

func (s *LKSec) GetSecret(lctx LoginContext) (secret []byte, err error) {
	s.G().Log.Debug("+ LKsec:GetSecret()")
	defer func() {
		s.G().Log.Debug("- LKSec::GetSecret() -> %s", ErrToOk(err))
	}()

	if err = s.Load(lctx); err != nil {
		return
	}

	secret = s.secret
	return
}

func (s *LKSec) Encrypt(src []byte) (res []byte, err error) {
	s.G().Log.Debug("+ LKsec:Encrypt()")
	defer func() {
		s.G().Log.Debug("- LKSec::Encrypt() -> %s", ErrToOk(err))
	}()

	if err = s.Load(nil); err != nil {
		return nil, err
	}
	var nonce []byte
	nonce, err = RandBytes(24)
	if err != nil {
		return nil, err
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	fs := s.fsecret()
	box := secretbox.Seal(nil, src, &fnonce, &fs)

	return append(nonce, box...), nil
}

func (s *LKSec) Decrypt(lctx LoginContext, src []byte) (res []byte, gen PassphraseGeneration, err error) {
	s.G().Log.Debug("+ LKsec:Decrypt()")
	defer func() {
		s.G().Log.Debug("- LKSec::Decrypt() -> %s", ErrToOk(err))
	}()

	if err = s.Load(lctx); err != nil {
		return nil, 0, err
	}
	var nonce [24]byte
	copy(nonce[:], src[0:24])
	data := src[24:]
	fs := s.fsecret()
	res, ok := secretbox.Open(nil, data, &nonce, &fs)
	if !ok {
		err = PassphraseError{"failed to open secretbox"}
		return nil, 0, err
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
func NewLKSecForEncrypt(ui SecretUI, uid keybase1.UID, gc *GlobalContext) (ret *LKSec, err error) {
	var pps *PassphraseStream
	if pps, err = gc.LoginState().GetPassphraseStream(ui); err != nil {
		return
	}
	ret = NewLKSec(pps, uid, gc)
	return
}

// EncryptClientHalfRecovery takes the client half of the LKS secret
// and encrypts it for the given key.  This is for recovery of passphrases
// on device recovery operations.
func (s *LKSec) EncryptClientHalfRecovery(key GenericKey) (string, error) {
	return key.EncryptToString(s.clientHalf, nil)
}

// ToSKB exports a generic key with the given LKSec to a SecretKeyBundle,
// performing all necessary encryption.
func (s *LKSec) ToSKB(key GenericKey) (ret *SKB, err error) {
	if s == nil {
		return nil, errors.New("nil lks")
	}
	ret = NewSKB(s.G())

	var publicKey RawPublicKey
	var privateKey RawPrivateKey

	publicKey, privateKey, err = key.ExportPublicAndPrivate()
	ret.Priv.Data, err = s.Encrypt([]byte(privateKey))
	if err != nil {
		return nil, err
	}
	ret.Priv.Encryption = LKSecVersion
	ret.Priv.PassphraseGeneration = int(s.Generation())
	ret.Pub = []byte(publicKey)
	ret.Type = key.GetAlgoType()
	return ret, nil
}

func WriteLksSKBToKeyring(g *GlobalContext, k GenericKey, lks *LKSec, lctx LoginContext) (*SKB, error) {
	skb, err := lks.ToSKB(k)
	if err != nil {
		return nil, fmt.Errorf("k.ToLksSKB() error: %s", err)
	}
	if err := skbPushAndSave(g, skb, lctx); err != nil {
		return nil, err
	}
	return skb, nil
}
