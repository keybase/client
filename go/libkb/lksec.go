// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/secretbox"
)

const LKSecVersion = 100
const LKSecLen = 32

type LKSecClientHalf struct {
	c *[LKSecLen]byte
}

func (c LKSecClientHalf) IsNil() bool {
	return c.c == nil
}

func (c LKSecClientHalf) Bytes() []byte {
	if c.c == nil {
		return nil
	}
	return c.c[:]
}

type LKSecServerHalf struct {
	s *[LKSecLen]byte
}

func (s LKSecServerHalf) IsNil() bool {
	return s.s == nil
}

type LKSecFullSecret struct {
	f *[LKSecLen]byte
}

type LKSecMask struct {
	m *[LKSecLen]byte
}

func (f LKSecFullSecret) IsNil() bool {
	return f.f == nil
}

func (f LKSecFullSecret) Bytes() []byte {
	if f.f == nil {
		return nil
	}
	return f.f[:]
}

func NewLKSecServerHalfFromHex(s string) (ret LKSecServerHalf, err error) {
	var b []byte
	b, err = hex.DecodeString(s)
	if err != nil {
		return ret, err
	}
	if len(b) != LKSecLen {
		err = fmt.Errorf("Wrong LKSec server length: %d != %d", len(b), LKSecLen)
		return ret, err
	}
	var v [LKSecLen]byte
	copy(v[:], b)
	ret = LKSecServerHalf{s: &v}
	return ret, nil
}

func newLKSecFullSecretFromBytes(b []byte) (ret LKSecFullSecret, err error) {
	if len(b) != LKSecLen {
		err = fmt.Errorf("Wrong LKSecFullSecret len: %d != %d", len(b), LKSecLen)
		return ret, err
	}
	var v [LKSecLen]byte
	copy(v[:], b)
	ret = LKSecFullSecret{f: &v}
	return ret, nil
}

func NewLKSecClientHalfFromBytes(b []byte) (ret LKSecClientHalf, err error) {
	if len(b) != LKSecLen {
		err = fmt.Errorf("Wrong LKSecClientHalf len: %d != %d", len(b), LKSecLen)
		return ret, err
	}
	var v [LKSecLen]byte
	copy(v[:], b)
	ret = LKSecClientHalf{c: &v}
	return ret, nil
}

func (f LKSecFullSecret) Equal(f2 LKSecFullSecret) bool {
	if f.IsNil() {
		return false
	}
	if f2.IsNil() {
		return false
	}
	return hmac.Equal(f.f[:], f2.f[:])
}

func (s LKSecServerHalf) EncodeToHex() string {
	if s.IsNil() {
		return ""
	}
	return hex.EncodeToString(s.s[:])
}

func (m LKSecMask) IsNil() bool {
	return m.m == nil
}

func (m LKSecMask) EncodeToHex() string {
	if m.IsNil() {
		return ""
	}
	return hex.EncodeToString(m.m[:])
}

func NewLKSecServerHalfZeros() LKSecServerHalf {
	var z [LKSecLen]byte
	return LKSecServerHalf{s: &z}
}

type LKSec struct {
	serverHalf LKSecServerHalf
	clientHalf LKSecClientHalf
	secret     LKSecFullSecret
	ppGen      PassphraseGeneration
	uid        keybase1.UID
	Contextified
}

func (s LKSecServerHalf) ComputeFullSecret(c LKSecClientHalf) LKSecFullSecret {
	var ret [LKSecLen]byte
	for i := 0; i < LKSecLen; i++ {
		ret[i] = s.s[i] ^ c.c[i]
	}
	return LKSecFullSecret{f: &ret}
}

func (s LKSecServerHalf) ComputeClientHalf(f LKSecFullSecret) LKSecClientHalf {
	var ret [LKSecLen]byte
	for i := 0; i < LKSecLen; i++ {
		ret[i] = s.s[i] ^ f.f[i]
	}
	return LKSecClientHalf{c: &ret}
}

func (c LKSecClientHalf) ComputeMask(c2 LKSecClientHalf) LKSecMask {
	var ret [LKSecLen]byte
	if c.IsNil() || c2.IsNil() {
		return LKSecMask{}
	}
	for i := 0; i < LKSecLen; i++ {
		ret[i] = c.c[i] ^ c2.c[i]
	}
	return LKSecMask{m: &ret}
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

func NewLKSecWithClientHalf(clientHalf LKSecClientHalf, ppgen PassphraseGeneration, uid keybase1.UID, gc *GlobalContext) *LKSec {
	return &LKSec{
		clientHalf:   clientHalf,
		ppGen:        ppgen,
		uid:          uid,
		Contextified: NewContextified(gc),
	}
}

func NewLKSecWithFullSecret(secret LKSecFullSecret, uid keybase1.UID, gc *GlobalContext) *LKSec {
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

func (s *LKSec) SetClientHalf(b LKSecClientHalf) {
	s.clientHalf = b
}

func (s *LKSec) SetServerHalf(b LKSecServerHalf) {
	s.serverHalf = b
}

// Generation returns the passphrase generation that this local key security
// object is derived from.
func (s LKSec) Generation() PassphraseGeneration {
	return s.ppGen
}

func (s *LKSec) GenerateServerHalf() error {
	if s.clientHalf.IsNil() {
		return errors.New("Can't generate server half without a client half")
	}
	if !s.serverHalf.IsNil() {
		return nil
	}
	var v [LKSecLen]byte
	var n int
	var err error
	if n, err = rand.Read(v[:]); err != nil {
		return err
	}
	if n != LKSecLen {
		return fmt.Errorf("short random read; wanted %d bytes but only got %d", LKSecLen, n)
	}
	s.serverHalf = LKSecServerHalf{s: &v}
	return nil
}

func (s *LKSec) GetServerHalf() LKSecServerHalf {
	return s.serverHalf
}

func (s *LKSec) Load(lctx LoginContext) (err error) {
	s.G().Log.Debug("+ LKSec::Load()")
	defer func() {
		s.G().Log.Debug("- LKSec::Load() -> %s", ErrToOk(err))
	}()

	if !s.secret.IsNil() {
		s.G().Log.Debug("| Short-circuit; we already know the full secret")
		return nil
	}

	if s.clientHalf.IsNil() {
		err = fmt.Errorf("client half not set")
		return err
	}

	if err = s.LoadServerHalf(lctx); err != nil {
		return err
	}

	s.secret = s.serverHalf.ComputeFullSecret(s.clientHalf)
	s.G().Log.Debug("| Making XOR'ed secret key for Local Key Security (LKS)")

	return nil
}

func (s *LKSec) LoadServerHalf(lctx LoginContext) (err error) {
	s.G().Log.Debug("+ LKSec::LoadServerHalf()")
	defer func() {
		s.G().Log.Debug("- LKSec::LoadServerHalf() -> %s", ErrToOk(err))
	}()

	if !s.serverHalf.IsNil() {
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
	if s.serverHalf.IsNil() {
		return fmt.Errorf("after apiServerHalf(%s), serverHalf still empty", devid)
	}

	return nil
}

func (s *LKSec) GetSecret(lctx LoginContext) (secret LKSecFullSecret, err error) {
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
	box := secretbox.Seal(nil, src, &fnonce, s.secret.f)

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
	res, ok := secretbox.Open(nil, data, &nonce, s.secret.f)
	if !ok {
		err = PassphraseError{"failed to open secretbox"}
		return nil, 0, err
	}

	return res, s.ppGen, nil
}

func (s *LKSec) ComputeClientHalf() (ret LKSecClientHalf, err error) {
	if !s.clientHalf.IsNil() {
		return s.clientHalf, nil
	}
	if s.serverHalf.IsNil() {
		return ret, errors.New("LKSec: tried to compute client half, but no server half loaded")
	}
	if s.secret.IsNil() {
		return ret, errors.New("LKSec: tried to compute client half, but no full secret loaded")
	}
	return s.serverHalf.ComputeClientHalf(s.secret), nil
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

	s.serverHalf, err = NewLKSecServerHalfFromHex(dev.LksServerHalf)
	if err != nil {
		return err
	}
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
	if s.clientHalf.IsNil() {
		return "", errors.New("Nil LKS Client Half")
	}
	return key.EncryptToString(s.clientHalf.Bytes(), nil)
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
